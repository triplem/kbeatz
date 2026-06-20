package org.javafreedom.kbeatz.catalog.infrastructure.move

import io.github.oshai.kotlinlogging.KotlinLogging
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardCopyOption
import org.javafreedom.kbeatz.catalog.domain.model.Album
import org.javafreedom.kbeatz.catalog.domain.model.WRITE_LOCK_FILENAME
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumRepository

private val log = KotlinLogging.logger {}

/**
 * Reconciles directory moves that were interrupted by a process kill (issue #814, AC-E8).
 *
 * On startup, BEFORE the HTTP server accepts traffic, [recoverInterruptedMoves] scans [dataDir]
 * for [MoveJournal] files and brings each affected album back to a fully-applied or fully-unapplied
 * state. No album is ever left half-applied, and the DB is never pointed at a path that does not
 * exist on disk.
 *
 * ## Why the journal phase matters
 *
 * The primary directory move and the merged-directory moves do not complete atomically as a group:
 * [DirectoryMoveExecutor] flips the journal to [MovePhase.MOVED] only AFTER every merged move
 * finishes. A crash that lands after the primary move but during a merged move therefore leaves a
 * journal at phase [MovePhase.PLANNED] with the primary already at its target. Deciding roll-forward
 * purely from the primary directory state (source gone, target present) would then commit
 * [Album.mergedDirectories] = the merged TARGET paths while the real files still sit at the merged
 * SOURCE - a DB row pointing at non-existent directories. Recovery must honour the journal phase.
 *
 * ## Decision per journal
 *
 * Let `primaryMoved` = the primary source is gone AND the primary target exists.
 *
 * - NOT `primaryMoved` (source still present, or target absent): roll BACK. The move had not safely
 *   completed; remove any partial staging/target, leave the source intact, leave the DB unchanged.
 * - `primaryMoved` AND phase == [MovePhase.MOVED] AND every merged target exists: roll FORWARD.
 *   The on-disk move finished; ensure [Album.directoryPath] / [Album.mergedDirectories] match the
 *   targets.
 * - `primaryMoved` but phase == [MovePhase.PLANNED] (or a merged target is still missing): the move
 *   is only partially applied. Reconcile by FINISHING FORWARD: move any merged source that still
 *   exists to its recorded target, then re-check. When every merged target now exists, commit the
 *   target paths (a fully-consistent MOVED state); otherwise a merged directory is genuinely lost
 *   (source missing AND target missing), so the inconsistency is logged and the journal is RETAINED
 *   for operator inspection rather than committing a path to a directory that does not exist.
 *
 * The finish-forward step is deterministic and chosen over rolling the primary back: once the
 * primary has physically moved, completing the remaining merged moves keeps disk and DB in agreement
 * with the least data movement and never deletes the only copy of any directory.
 *
 * The component is idempotent: every branch is driven purely by the current on-disk state plus the
 * journal phase, and the journal is removed once the album reaches a fully-consistent state. A
 * second run over a now-removed journal is a no-op, and a second run over a retained (inconsistent)
 * journal repeats the same safe checks without double-applying anything.
 *
 * @param albumRepository Repository used to complete a rolled-forward DB update.
 * @param dataDir Directory holding move journals (the same location [DirectoryMoveExecutor] writes).
 */
class DirectoryMoveRecovery(
    private val albumRepository: AlbumRepository,
    private val dataDir: Path,
) {
    /** Scans for move journals and reconciles each affected album. Safe to call on every startup. */
    suspend fun recoverInterruptedMoves() {
        val journals = collectJournals()
        if (journals.isEmpty()) {
            log.info { "No $MOVE_JOURNAL_FILENAME files found - skipping move recovery" }
            return
        }
        log.info { "Found ${journals.size} move journal(s) - running move recovery" }
        journals.forEach { recoverOne(it) }
    }

    private fun collectJournals(): List<Path> {
        if (!Files.isDirectory(dataDir)) return emptyList()
        return Files.list(dataDir).use { stream ->
            stream
                .filter { it.fileName.toString().endsWith(MOVE_JOURNAL_FILENAME) }
                .sorted()
                .toList()
        }
    }

    @Suppress("TooGenericExceptionCaught") // one bad journal must not abort startup for the others
    private suspend fun recoverOne(journalFile: Path) {
        try {
            val journal = MoveJournal.readFrom(journalFile)
            if (journal == null) {
                log.warn { "move_recovery_skip file=$journalFile reason=unreadable_or_corrupt" }
                Files.deleteIfExists(journalFile)
                return
            }
            reconcile(journal, journalFile)
        } catch (ex: kotlinx.coroutines.CancellationException) {
            throw ex
        } catch (ex: Exception) {
            log.error(ex) { "move_recovery_failed file=$journalFile - journal retained for next startup" }
        }
    }

    /**
     * Routes a single journal to roll-forward, finish-forward, or roll-back per the decision table
     * in the class KDoc, deleting the journal only once the album is fully consistent.
     */
    private suspend fun reconcile(journal: MoveJournal, journalFile: Path) {
        if (!primaryMoved(journal)) {
            rollBack(journal)
            Files.deleteIfExists(journalFile)
            return
        }
        val fullyMoved = journal.phase == MovePhase.MOVED && allMergedTargetsPresent(journal)
        if (fullyMoved) {
            rollForward(journal)
            Files.deleteIfExists(journalFile)
            return
        }
        finishForward(journal, journalFile)
    }

    private fun primaryMoved(journal: MoveJournal): Boolean =
        !Files.exists(Path.of(journal.fromPath)) && Files.exists(Path.of(journal.toPath))

    private fun allMergedTargetsPresent(journal: MoveJournal): Boolean =
        journal.mergedToPaths.all { Files.exists(Path.of(it)) }

    private suspend fun rollForward(journal: MoveJournal) {
        commitTargetPaths(journal)
        log.info { "move_recovery_roll_forward albumId=${journal.albumId} to=${journal.toPath}" }
    }

    /**
     * Completes a partially-applied move (primary at target, but some merged directories still at
     * their source or with a missing target) by moving each remaining merged source to its target,
     * then committing the target paths once every merged target exists. If a merged directory is
     * lost (its source AND target are both missing) the journal is retained rather than committing a
     * path to a non-existent directory.
     */
    private suspend fun finishForward(journal: MoveJournal, journalFile: Path) {
        journal.mergedFromPaths.forEachIndexed { index, mergedFromRaw ->
            val mergedFrom = Path.of(mergedFromRaw)
            val mergedTo = Path.of(journal.mergedToPaths[index])
            if (Files.exists(mergedFrom) && !Files.exists(mergedTo)) {
                moveMergedDirectory(mergedFrom, mergedTo)
            }
        }
        if (!allMergedTargetsPresent(journal)) {
            val lost = journal.mergedToPaths.filterNot { Files.exists(Path.of(it)) }
            log.error {
                "move_recovery_inconsistent albumId=${journal.albumId} missingTargets=$lost - " +
                    "journal retained; merged source and target both absent"
            }
            return
        }
        commitTargetPaths(journal)
        clearSourceLock(journal.toPath)
        Files.deleteIfExists(journalFile)
        log.info { "move_recovery_finish_forward albumId=${journal.albumId} to=${journal.toPath}" }
    }

    /** Atomically moves a still-pending merged directory to its target, creating parents first. */
    private fun moveMergedDirectory(mergedFrom: Path, mergedTo: Path) {
        mergedTo.parent?.let { Files.createDirectories(it) }
        Files.move(mergedFrom, mergedTo, StandardCopyOption.ATOMIC_MOVE)
        Files.deleteIfExists(mergedTo.resolve(WRITE_LOCK_FILENAME))
    }

    /** Commits the album's directory and merged paths to their targets, skipping a redundant write. */
    private suspend fun commitTargetPaths(journal: MoveJournal) {
        val album = albumRepository.findById(journal.albumId) ?: return
        if (album.directoryPath == journal.toPath && album.mergedDirectories == journal.mergedToPaths) {
            return
        }
        val updated: Album = album.copy(
            directoryPath = journal.toPath,
            mergedDirectories = journal.mergedToPaths,
        )
        albumRepository.save(updated)
    }

    private fun rollBack(journal: MoveJournal) {
        cleanPartialTarget(journal.toPath)
        journal.mergedToPaths.forEach { cleanPartialTarget(it) }
        clearSourceLock(journal.fromPath)
        log.info { "move_recovery_roll_back albumId=${journal.albumId} from=${journal.fromPath}" }
    }

    /**
     * Removes a target only when the source still exists, so a partially-copied target left by a
     * crashed copy-verify-swap is discarded without ever touching a target that already holds the
     * only copy of the data.
     */
    private fun cleanPartialTarget(targetPath: String) {
        // The matching source is the move source for the primary, or the merged source; in both
        // roll-back cases the source is intact (that is what defines a roll-back), so a target that
        // exists here is a partial copy and is safe to delete.
        val target = Path.of(targetPath)
        if (Files.exists(target)) target.toFile().deleteRecursively()
        val staging = target.resolveSibling("${target.fileName}${DirectoryMoveExecutor.STAGING_SUFFIX}")
        if (Files.exists(staging)) staging.toFile().deleteRecursively()
    }

    private fun clearSourceLock(directoryPath: String) {
        Files.deleteIfExists(Path.of(directoryPath).resolve(WRITE_LOCK_FILENAME))
    }
}
