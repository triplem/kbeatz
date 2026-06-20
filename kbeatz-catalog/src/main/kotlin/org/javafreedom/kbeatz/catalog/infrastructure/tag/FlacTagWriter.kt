package org.javafreedom.kbeatz.catalog.infrastructure.tag

import io.github.oshai.kotlinlogging.KotlinLogging
import java.nio.file.Files
import java.nio.file.Path
import kotlin.uuid.Uuid
import kotlinx.io.files.Path as KtPath
import org.javafreedom.kbeatz.catalog.domain.model.WRITE_LOCK_FILENAME
import org.javafreedom.kbeatz.catalog.util.PathGuard
import org.javafreedom.kbeatz.catalog.util.sanitizeForLog
import org.javafreedom.kbeatz.common.ConflictException
import org.javafreedom.kbeatz.tagger.codec.flac.FlacFile

private val log = KotlinLogging.logger {}

/**
 * The single, atomic FLAC tag-write path for the catalog service (story #817).
 *
 * This is the ONLY place in the catalog that mutates Vorbis Comment fields on disk. Manual
 * retagging ([org.javafreedom.kbeatz.catalog.application.service.TagWriteService]), Discogs sync
 * ([org.javafreedom.kbeatz.catalog.infrastructure.sync.DiscogsSyncService]) and change-plan apply
 * ([org.javafreedom.kbeatz.catalog.application.service.FlacTagChangeApplier]) all converge here, so
 * there is no second code path that writes FLAC tags directly (AC-E10).
 *
 * ## Atomicity
 * Each FLAC file is rewritten via [FlacFile.writeTo], which performs a temp-file write followed by
 * an atomic rename (ADR-001). Writes across multiple files are sequential, not transactional: a
 * failure mid-batch leaves already-written files updated and the rest unchanged, and the
 * `.kbeatz-write.lock` manifest remains so startup repair can detect the partial write.
 *
 * ## Write-lock manifest
 * Album-level writes create a `.kbeatz-write.lock` manifest in the primary directory listing every
 * target FLAC file (primary + merged) before any write, and remove it in a `finally` block. A
 * single-file write performs one atomic operation and needs no manifest.
 *
 * @param libraryRoot Absolute library root used by [PathGuard] to reject path-traversal escapes.
 */
class FlacTagWriter(private val libraryRoot: Path) {

    /**
     * Writes [fields] (Vorbis field name -> value) to every FLAC file in [primaryDir] and each of
     * [mergedDirs], under one write-lock manifest created in [primaryDir].
     *
     * Behaviour preserved from the original `TagWriteService` implementation:
     * - All directory paths are validated against [libraryRoot] BEFORE any disk access, so a
     *   traversal path is rejected even when the directory does not exist (issues #724 / #765).
     * - A merged directory that no longer exists on disk is skipped with a WARN; the primary write
     *   is unaffected.
     * - An existing `.kbeatz-write.lock` in [primaryDir] means another writer (e.g. the CLI) is
     *   active: a [ConflictException] is thrown before anything is touched.
     * - Writes are NOT atomic across directories. The primary directory is written first, then each
     *   merged directory in order; a merged failure is logged with progress context and rethrown
     *   without rolling back the primary write.
     *
     * @param albumId Album UUID, used only for structured log context.
     * @param primaryDir The primary album directory.
     * @param mergedDirs Additional merged source directories (may be empty).
     * @param fields Vorbis Comment fields to set. Field names must already be normalised.
     * @param removeLockOnFailure When true (the manual-retag / change-plan-apply contract) the
     *   manifest is always removed, even when a write fails. When false (the Discogs-sync contract)
     *   a failed write retains the manifest so startup repair can detect the partial write.
     * @throws SecurityException when any directory escapes [libraryRoot].
     * @throws ConflictException when a write-lock is already held in [primaryDir].
     */
    fun writeAlbumFields(
        albumId: Uuid,
        primaryDir: Path,
        mergedDirs: List<String>,
        fields: Map<String, String>,
        removeLockOnFailure: Boolean = true,
    ) {
        validatePath(primaryDir)

        if (Files.exists(primaryDir.resolve(WRITE_LOCK_FILENAME))) {
            throw ConflictException(
                "Album write in progress, retry later (write lock found in $primaryDir)"
            )
        }

        val primaryFlacFiles = findFlacFiles(primaryDir)

        // validatePath is always called first (even for non-existent paths) so traversal sequences
        // are rejected regardless of whether the directory exists on disk. Insertion order is
        // preserved for deterministic write sequencing.
        val mergedDirToFlacFiles: Map<Path, List<Path>> = mergedDirs
            .mapNotNull { dirPath ->
                val mergedDir = Path.of(dirPath)
                validatePath(mergedDir)
                if (!Files.isDirectory(mergedDir)) {
                    log.warn {
                        "merged_dir_skip albumId=$albumId path=${dirPath.sanitizeForLog()} " +
                            "reason=directory_not_found"
                    }
                    null
                } else {
                    mergedDir to findFlacFiles(mergedDir)
                }
            }
            .toMap()

        val allFlacFiles = primaryFlacFiles + mergedDirToFlacFiles.values.flatten()
        writeLockFile(primaryDir, allFlacFiles)

        @Suppress("TooGenericExceptionCaught") // intentional: any failure controls lock removal then rethrows
        try {
            writeFieldsToFiles(primaryFlacFiles, fields, albumId)
            var mergedDirsCompleted = 0
            mergedDirToFlacFiles.forEach { (mergedDir, mergedFiles) ->
                try {
                    writeFieldsToFiles(mergedFiles, fields, albumId)
                    mergedDirsCompleted++
                    log.info {
                        "merged_dir_write_complete albumId=$albumId fieldCount=${fields.size} " +
                            "dir=$mergedDir fileCount=${mergedFiles.size}"
                    }
                } catch (e: Exception) {
                    log.error(e) {
                        "merged_dir_write_failed albumId=$albumId fieldCount=${fields.size} " +
                            "dir=$mergedDir mergedDirsCompleted=$mergedDirsCompleted " +
                            "mergedDirsTotal=${mergedDirToFlacFiles.size}"
                    }
                    throw e
                }
            }
        } catch (e: Exception) {
            // Manual-retag / change-plan-apply remove the manifest unconditionally so a transient
            // failure never leaves a stuck lock. Discogs sync retains it so startup repair can
            // detect and finish (or roll back) a partial write.
            if (removeLockOnFailure) deleteLockFile(primaryDir)
            throw e
        }

        deleteLockFile(primaryDir)
        log.info {
            "album_tag_write_complete albumId=$albumId fieldCount=${fields.size} " +
                "primaryFiles=${primaryFlacFiles.size} mergedDirCount=${mergedDirToFlacFiles.size}"
        }
    }

    /**
     * Writes [fields] to a single FLAC file atomically, without a write-lock manifest.
     *
     * Used by track-level writes, where a single atomic temp-file rename is safe without a manifest.
     *
     * @param flacPath The FLAC file to update; its parent directory must be within [libraryRoot].
     * @param fields Vorbis Comment fields to set. Field names must already be normalised.
     * @throws SecurityException when [flacPath] escapes [libraryRoot].
     */
    fun writeSingleFile(flacPath: Path, fields: Map<String, String>) {
        validatePath(flacPath)
        FlacFile.read(KtPath(flacPath.toString()))
            .updateVorbisComment { editor -> fields.forEach { (k, v) -> editor.set(k, v) }; editor }
            .writeTo(KtPath(flacPath.toString()))
        log.debug { "Tag written path=$flacPath fieldCount=${fields.size}" }
    }

    private fun validatePath(path: Path) {
        PathGuard.assertWithinLibraryRoot(path, libraryRoot)
    }

    private fun findFlacFiles(albumDir: Path): List<Path> =
        if (Files.isDirectory(albumDir)) {
            Files.list(albumDir).use { stream ->
                stream
                    .filter { it.fileName.toString().endsWith(".flac", ignoreCase = true) }
                    .sorted()
                    .toList()
            }
        } else {
            emptyList()
        }

    private fun writeLockFile(albumDir: Path, flacFiles: List<Path>) {
        if (flacFiles.isEmpty()) return
        Files.createDirectories(albumDir)
        val manifest = flacFiles.joinToString("\n") { it.toString() }
        Files.writeString(albumDir.resolve(WRITE_LOCK_FILENAME), manifest)
        log.debug { "Write-lock manifest created in $albumDir (${flacFiles.size} files)" }
    }

    private fun deleteLockFile(albumDir: Path) {
        Files.deleteIfExists(albumDir.resolve(WRITE_LOCK_FILENAME))
        log.debug { "Write-lock manifest removed from $albumDir" }
    }

    private fun writeFieldsToFiles(files: List<Path>, fields: Map<String, String>, albumId: Uuid) {
        files.forEach { flacPath ->
            FlacFile.read(KtPath(flacPath.toString()))
                .updateVorbisComment { editor -> fields.forEach { (k, v) -> editor.set(k, v) }; editor }
                .writeTo(KtPath(flacPath.toString()))
            log.debug { "Tag written albumId=$albumId path=$flacPath fieldCount=${fields.size}" }
        }
    }
}
