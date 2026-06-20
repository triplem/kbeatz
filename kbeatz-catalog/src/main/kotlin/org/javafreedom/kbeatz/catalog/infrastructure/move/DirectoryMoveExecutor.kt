package org.javafreedom.kbeatz.catalog.infrastructure.move

import io.github.oshai.kotlinlogging.KotlinLogging
import java.io.IOException
import java.nio.file.AtomicMoveNotSupportedException
import java.nio.file.FileVisitResult
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.SimpleFileVisitor
import java.nio.file.StandardCopyOption
import java.nio.file.attribute.BasicFileAttributes
import org.javafreedom.kbeatz.catalog.domain.model.Album
import org.javafreedom.kbeatz.catalog.domain.model.DirectoryMove
import org.javafreedom.kbeatz.catalog.domain.model.WRITE_LOCK_FILENAME
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumRepository
import org.javafreedom.kbeatz.catalog.util.PathGuard
import org.javafreedom.kbeatz.common.ConflictException
import org.javafreedom.kbeatz.common.ResourceNotFoundException

private val log = KotlinLogging.logger {}

/**
 * Moves (renames) a release directory on disk and updates the catalog database to match.
 *
 * ## Data-safety guarantees (issue #814)
 *
 * This executor moves the user's real music directories, so correctness is paramount:
 *
 * - A [MoveJournal] is written to [dataDir] (a stable location OUTSIDE the moving directory)
 *   BEFORE any file is touched. A process kill at any point leaves a journal from which
 *   [DirectoryMoveRecovery] deterministically rolls forward or back on next startup.
 * - The primary move uses [StandardCopyOption.ATOMIC_MOVE]. When the platform cannot move
 *   atomically (e.g. across filesystems) it falls back to copy-into-a-temp-target,
 *   verify-every-file, atomic-swap-into-place, then delete-source. The source is NEVER
 *   deleted until the target is fully and verifiably present.
 * - A `.kbeatz-write.lock` sentinel is written into the source directory for the duration of
 *   the move so concurrent writers (catalog or CLI) cannot touch the same files. A pre-existing
 *   lock causes a fail-fast [ConflictException].
 *
 * ## Track paths
 *
 * [org.javafreedom.kbeatz.catalog.domain.model.Track.path] is stored RELATIVE to
 * [Album.directoryPath]. A pure rename of the album root therefore keeps every track path valid
 * unchanged: only [Album.directoryPath] (and [Album.mergedDirectories]) are rewritten in the DB.
 * Disc subdirectories (`disc1/`, `disc2/`) move with the root, so multi-disc albums are handled
 * by the single root move with no per-track rewrite.
 *
 * ## Merged-directory relocation semantics
 *
 * Each merged source directory is relocated INTO the target as a sibling subdirectory named after
 * its original leaf name (e.g. `target/<mergedLeafName>/`), preserving its internal structure so
 * its tracks still resolve. Physical consolidation of merged directories into a single tree is out
 * of scope for #814 (left to a future rescan); this executor only relocates them and records their
 * new absolute locations in [Album.mergedDirectories].
 *
 * @param albumRepository Repository used to read the album and persist the updated paths.
 * @param libraryRoot Library root; source and target must both resolve within it.
 * @param dataDir Stable directory where move journals are written (survives the moving directory).
 */
class DirectoryMoveExecutor(
    private val albumRepository: AlbumRepository,
    private val libraryRoot: Path,
    private val dataDir: Path,
) {
    /**
     * Executes [move] for a single album: validates, journals, moves files atomically (or via a
     * journaled copy-verify-swap fallback), relocates merged directories, then commits the new
     * paths to the database and removes the journal.
     *
     * Idempotent: re-running a completed move (source gone, target present, DB already updated)
     * is a no-op.
     *
     * @throws ResourceNotFoundException when the album or its source directory is missing.
     * @throws ConflictException when the target already exists or a write-lock is held in the source.
     * @throws PathTraversalException when source or target escapes [libraryRoot].
     */
    suspend fun execute(move: DirectoryMove) {
        val from = Path.of(move.fromPath)
        val to = Path.of(move.toPath)
        if (from == to) {
            log.info { "directory_move_noop albumId=${move.albumId} path=${move.fromPath}" }
            return
        }
        if (isAlreadyApplied(from, to)) {
            reconcileAlreadyApplied(move, to)
            return
        }
        validateMove(from, to)

        val plan = buildMergedPlan(to, move.mergedFromPaths)
        val journalFile = journalFileFor(move.albumId)
        writeJournal(journalFile, move, plan, MovePhase.PLANNED)
        writeSourceLock(from)

        log.info { "directory_move_start albumId=${move.albumId} from=${move.fromPath} to=${move.toPath}" }
        moveDirectory(from, to)
        plan.forEach { (mergedFrom, mergedTo) -> moveDirectory(mergedFrom, mergedTo) }
        writeJournal(journalFile, move, plan, MovePhase.MOVED)

        commitPaths(move.albumId, move.toPath, plan.map { it.second.toString() })
        Files.deleteIfExists(journalFile)
        log.info { "directory_move_success albumId=${move.albumId} to=${move.toPath}" }
    }

    private fun isAlreadyApplied(from: Path, to: Path): Boolean =
        !Files.exists(from) && Files.exists(to)

    private suspend fun reconcileAlreadyApplied(move: DirectoryMove, to: Path) {
        val album = albumRepository.findById(move.albumId)
        if (album != null && album.directoryPath != move.toPath) {
            val mergedTargets = buildMergedPlan(to, move.mergedFromPaths).map { it.second.toString() }
            commitPaths(move.albumId, move.toPath, mergedTargets)
        }
        Files.deleteIfExists(journalFileFor(move.albumId))
        log.info { "directory_move_noop_already_applied albumId=${move.albumId} to=${move.toPath}" }
    }

    private fun validateMove(from: Path, to: Path) {
        PathGuard.assertWithinLibraryRoot(from, libraryRoot)
        PathGuard.assertWithinLibraryRoot(to, libraryRoot)
        if (!Files.isDirectory(from)) {
            throw ResourceNotFoundException("Source directory", from.toString())
        }
        if (Files.exists(to)) {
            throw ConflictException("Target directory already exists: $to")
        }
        if (Files.exists(from.resolve(WRITE_LOCK_FILENAME))) {
            throw ConflictException("Source directory is locked by another writer: $from")
        }
    }

    /**
     * Computes the (source, target) pair for each merged directory. Each merged directory is
     * relocated to `target/<leafName>/`, validated to remain within the library root.
     */
    private fun buildMergedPlan(to: Path, mergedFromPaths: List<String>): List<Pair<Path, Path>> =
        mergedFromPaths.map { raw ->
            val mergedFrom = Path.of(raw)
            PathGuard.assertWithinLibraryRoot(mergedFrom, libraryRoot)
            val mergedTo = to.resolve(mergedFrom.fileName.toString())
            PathGuard.assertWithinLibraryRoot(mergedTo, libraryRoot)
            mergedFrom to mergedTo
        }

    private fun journalFileFor(albumId: Uuidish): Path =
        dataDir.resolve("$albumId$MOVE_JOURNAL_FILENAME")

    private fun writeJournal(
        journalFile: Path,
        move: DirectoryMove,
        plan: List<Pair<Path, Path>>,
        phase: MovePhase,
    ) {
        Files.createDirectories(dataDir)
        val journal = MoveJournal(
            albumId = move.albumId,
            fromPath = move.fromPath,
            toPath = move.toPath,
            mergedFromPaths = plan.map { it.first.toString() },
            mergedToPaths = plan.map { it.second.toString() },
            phase = phase,
        )
        Files.writeString(journalFile, journal.encode())
    }

    private fun writeSourceLock(from: Path) {
        Files.writeString(from.resolve(WRITE_LOCK_FILENAME), MOVE_LOCK_MANIFEST)
    }

    /**
     * Moves [from] to [to] atomically, creating the target parent first. Falls back to a journaled
     * copy-verify-swap when the platform refuses an atomic move (e.g. across filesystems). The
     * source is removed only after the target is verified complete. The source write-lock sentinel
     * is not copied to the target.
     */
    private fun moveDirectory(from: Path, to: Path) {
        if (!Files.exists(from)) return
        to.parent?.let { Files.createDirectories(it) }
        try {
            Files.move(from, to, StandardCopyOption.ATOMIC_MOVE)
        } catch (ex: AtomicMoveNotSupportedException) {
            log.warn(ex) { "atomic_move_unsupported from=$from to=$to - using copy-verify-swap fallback" }
            copyVerifySwap(from, to)
        }
        Files.deleteIfExists(to.resolve(WRITE_LOCK_FILENAME))
    }

    /**
     * Cross-filesystem fallback for [moveDirectory]: copy the source tree into a sibling staging
     * directory, verify every file copied, atomically swap the staging dir into place, then delete
     * the source. Exposed as `internal` so the data-critical path can be unit-tested directly
     * (an [AtomicMoveNotSupportedException] cannot be provoked on a single tmpfs).
     */
    internal fun copyVerifySwap(from: Path, to: Path) {
        val staging = to.resolveSibling("${to.fileName}$STAGING_SUFFIX")
        deleteRecursively(staging)
        copyTree(from, staging)
        verifyTreeCopied(from, staging)
        Files.move(staging, to)
        deleteRecursively(from)
    }

    private fun copyTree(source: Path, target: Path) {
        Files.walkFileTree(source, object : SimpleFileVisitor<Path>() {
            override fun preVisitDirectory(dir: Path, attrs: BasicFileAttributes): FileVisitResult {
                Files.createDirectories(target.resolve(source.relativize(dir).toString()))
                return FileVisitResult.CONTINUE
            }

            override fun visitFile(file: Path, attrs: BasicFileAttributes): FileVisitResult {
                Files.copy(file, target.resolve(source.relativize(file).toString()), StandardCopyOption.COPY_ATTRIBUTES)
                return FileVisitResult.CONTINUE
            }
        })
    }

    /**
     * Asserts that every regular file under [source] exists in [target] with an identical byte
     * length. Throws [IOException] if any file is missing or differs, so the caller aborts before
     * deleting the source.
     */
    private fun verifyTreeCopied(source: Path, target: Path) {
        Files.walkFileTree(source, object : SimpleFileVisitor<Path>() {
            override fun visitFile(file: Path, attrs: BasicFileAttributes): FileVisitResult {
                val copied = target.resolve(source.relativize(file).toString())
                if (!Files.isRegularFile(copied) || Files.size(copied) != attrs.size()) {
                    throw IOException("Copy verification failed for $file -> $copied")
                }
                return FileVisitResult.CONTINUE
            }
        })
    }

    private suspend fun commitPaths(albumId: Uuidish, toPath: String, mergedTargets: List<String>) {
        val album = albumRepository.findById(albumId)
            ?: throw ResourceNotFoundException("Album", albumId.toString())
        val updated: Album = album.copy(directoryPath = toPath, mergedDirectories = mergedTargets)
        albumRepository.save(updated)
    }

    private fun deleteRecursively(path: Path) {
        if (Files.exists(path)) path.toFile().deleteRecursively()
    }

    companion object {
        /** Manifest written into the source write-lock during a move (for operator diagnosis). */
        const val MOVE_LOCK_MANIFEST = "directory-move-in-progress"

        /** Suffix for the temporary staging directory used by the copy-verify-swap fallback. */
        const val STAGING_SUFFIX = ".kbeatz-move-staging"
    }
}

/** Alias documenting that the receiver is a [kotlin.uuid.Uuid]; keeps signatures terse. */
private typealias Uuidish = kotlin.uuid.Uuid
