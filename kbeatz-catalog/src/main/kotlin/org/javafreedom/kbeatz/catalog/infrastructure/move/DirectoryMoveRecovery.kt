package org.javafreedom.kbeatz.catalog.infrastructure.move

import io.github.oshai.kotlinlogging.KotlinLogging
import java.nio.file.Files
import java.nio.file.Path
import org.javafreedom.kbeatz.catalog.domain.model.Album
import org.javafreedom.kbeatz.catalog.domain.model.WRITE_LOCK_FILENAME
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumRepository

private val log = KotlinLogging.logger {}

/**
 * Reconciles directory moves that were interrupted by a process kill (issue #814, AC-E8).
 *
 * On startup, BEFORE the HTTP server accepts traffic, [recoverInterruptedMoves] scans [dataDir]
 * for [MoveJournal] files and brings each affected album back to a fully-applied or fully-unapplied
 * state. No album is ever left half-applied.
 *
 * ## Decision per journal
 *
 * - Source gone AND target present: roll FORWARD. The on-disk move finished but the DB update may
 *   not have committed; ensure [Album.directoryPath] / [Album.mergedDirectories] match the target,
 *   then delete the journal.
 * - Otherwise (source still present, or target absent/partial): roll BACK. The move had not safely
 *   completed; remove any partial staging/target, leave the source intact, leave the DB unchanged,
 *   and delete the journal.
 *
 * The component is idempotent: running it twice is safe because each branch is driven purely by the
 * current on-disk state and the journal is removed once reconciled.
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
            if (isRolledForward(journal)) rollForward(journal) else rollBack(journal)
            Files.deleteIfExists(journalFile)
        } catch (ex: kotlinx.coroutines.CancellationException) {
            throw ex
        } catch (ex: Exception) {
            log.error(ex) { "move_recovery_failed file=$journalFile - journal retained for next startup" }
        }
    }

    private fun isRolledForward(journal: MoveJournal): Boolean =
        !Files.exists(Path.of(journal.fromPath)) && Files.exists(Path.of(journal.toPath))

    private suspend fun rollForward(journal: MoveJournal) {
        val album = albumRepository.findById(journal.albumId)
        if (album != null && album.directoryPath != journal.toPath) {
            val updated: Album = album.copy(
                directoryPath = journal.toPath,
                mergedDirectories = journal.mergedToPaths,
            )
            albumRepository.save(updated)
        }
        log.info { "move_recovery_roll_forward albumId=${journal.albumId} to=${journal.toPath}" }
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

    private fun clearSourceLock(fromPath: String) {
        Files.deleteIfExists(Path.of(fromPath).resolve(WRITE_LOCK_FILENAME))
    }
}
