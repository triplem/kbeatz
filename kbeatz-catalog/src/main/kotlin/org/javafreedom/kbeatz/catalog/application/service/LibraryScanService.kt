package org.javafreedom.kbeatz.catalog.application.service

import io.github.oshai.kotlinlogging.KotlinLogging
import java.io.IOException
import java.nio.file.FileVisitResult
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.SimpleFileVisitor
import java.nio.file.attribute.BasicFileAttributes
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.atomic.AtomicReference
import kotlin.coroutines.CoroutineContext
import kotlin.io.path.deleteIfExists
import kotlin.time.Duration.Companion.seconds
import kotlin.uuid.Uuid
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout
import kotlin.time.Clock
import kotlin.time.Instant
import kotlinx.io.files.Path as KtPath
import org.javafreedom.kbeatz.catalog.domain.model.Album
import org.javafreedom.kbeatz.catalog.domain.model.AlbumGroup
import org.javafreedom.kbeatz.catalog.domain.model.ScanErrorEntry
import org.javafreedom.kbeatz.catalog.domain.model.ScanState
import org.javafreedom.kbeatz.catalog.domain.model.ScanStatus
import org.javafreedom.kbeatz.catalog.domain.model.ScanStatus.Companion.MAX_REPORTED_ERRORS
import org.javafreedom.kbeatz.catalog.domain.model.Track
import org.javafreedom.kbeatz.catalog.domain.model.WRITE_LOCK_FILENAME
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumRepository
import org.javafreedom.kbeatz.catalog.domain.repository.TrackRepository
import org.javafreedom.kbeatz.catalog.util.sanitizeForLog
import org.javafreedom.kbeatz.tagger.codec.flac.FlacFile
import org.javafreedom.kbeatz.tagger.codec.flac.FlacMetadataBlock

private val log = KotlinLogging.logger {}

/**
 * Manages asynchronous library scanning and progress tracking.
 *
 * ## State machine
 * `IDLE → RUNNING → COMPLETE | FAILED`
 *
 * Concurrent scan guard: calling [startScan] when a scan is already [ScanState.RUNNING] logs a
 * warning and returns immediately; no duplicate scan is launched.
 *
 * ## Progress tracking
 * [totalAlbums] is set from the initial [LibraryWalker] result count before processing begins.
 * [scannedAlbums] is incremented atomically after each album is successfully persisted.
 *
 * After [ScanState.COMPLETE], the album index in H2 contains all discovered albums sorted by
 * ALBUMARTIST. In-memory caching of the sorted list is deferred to a later story.
 */
class LibraryScanService(
    private val libraryRoot: Path,
    private val walker: LibraryWalker,
    private val albumRepository: AlbumRepository,
    private val trackRepository: TrackRepository,
    scanDispatcher: CoroutineContext = Dispatchers.IO,
    private val repairTimeoutSeconds: Long = DEFAULT_REPAIR_TIMEOUT_SECONDS,
) {
    private val scanScope = CoroutineScope(SupervisorJob() + scanDispatcher)
    private val state = AtomicReference(ScanState.IDLE)
    private val scannedAlbums = AtomicLong(0L)
    private val totalAlbums = AtomicLong(0L)
    private val startedAt = AtomicReference<Instant?>(null)
    private val completedAt = AtomicReference<Instant?>(null)
    private val errorMessage = AtomicReference<String?>(null)
    // Per-album errors collected during a scan (capped at MAX_REPORTED_ERRORS for the status snapshot).
    private val scanErrors = CopyOnWriteArrayList<ScanErrorEntry>()
    private val totalScanErrors = AtomicInteger(0)

    // Set to true after repairOnStartup() completes (or when no repair is needed).
    // The readiness probe returns 503 until this is true, so orchestrators do not
    // route traffic to the instance before consistency is restored.
    private val repairComplete = AtomicBoolean(false)

    /**
     * Returns true when the startup write-lock repair has completed and the service
     * is ready to accept traffic. Always false until [repairOnStartup] returns.
     */
    fun isRepairComplete(): Boolean = repairComplete.get()

    /**
     * Cancels all in-progress coroutines launched by this service.
     *
     * Must be called during application shutdown (before closing the database pool)
     * to prevent orphaned coroutines continuing to access a closed datasource.
     */
    fun close() {
        scanScope.cancel()
        log.info { "LibraryScanService scan scope cancelled" }
    }

    /** Returns a snapshot of the current scan state. */
    fun status(): ScanStatus = ScanStatus(
        state = state.get(),
        scannedAlbums = scannedAlbums.get(),
        totalAlbums = totalAlbums.get(),
        startedAt = startedAt.get(),
        completedAt = completedAt.get(),
        errorMessage = errorMessage.get(),
        errors = scanErrors.toList(),
        totalErrors = totalScanErrors.get(),
    )

    /**
     * Starts a background library scan if no scan is currently running.
     *
     * Returns immediately. Poll [status] for progress.
     */
    fun startScan() {
        if (!state.compareAndSet(ScanState.IDLE, ScanState.RUNNING) &&
            !state.compareAndSet(ScanState.COMPLETE, ScanState.RUNNING) &&
            !state.compareAndSet(ScanState.FAILED, ScanState.RUNNING)
        ) {
            log.warn { "Library scan already RUNNING - ignoring duplicate startScan() call" }
            return
        }

        scannedAlbums.set(0L)
        totalAlbums.set(0L)
        startedAt.set(Clock.System.now())
        completedAt.set(null)
        errorMessage.set(null)
        scanErrors.clear()
        totalScanErrors.set(0)

        scanScope.launch {
            runScan()
        }
    }

    /**
     * Synchronous startup repair: finds all `.kbeatz-write.lock` files under [libraryRoot],
     * re-indexes the containing album directory for each, then deletes the lock file.
     *
     * Must be called before HTTP requests are accepted. Runs on the caller's thread (blocking).
     * Lock files indicate a previous run was killed mid-write; re-indexing restores consistency.
     */
    /**
     * Synchronous startup repair: finds all `.kbeatz-write.lock` files under [libraryRoot],
     * re-indexes the containing album directory for each, then deletes the lock file.
     *
     * Sets [isRepairComplete] to `true` in a `finally` block so the readiness probe is
     * unblocked even when individual directories fail. Must be called before the HTTP server
     * begins accepting requests.
     *
     * If the repair scan does not complete within [repairTimeoutSeconds], the scan is aborted,
     * an ERROR is logged listing any unrepaired lock files, and startup continues. Unrepaired
     * albums will be re-indexed on the next POST /api/v1/library/scan call.
     */
    suspend fun repairOnStartup() {
        try {
            withTimeout(repairTimeoutSeconds.seconds) {
                val lockFiles = collectLockFiles()
                if (lockFiles.isEmpty()) {
                    log.info { "No .kbeatz-write.lock files found - skipping startup repair" }
                    return@withTimeout
                }
                log.info { "Found ${lockFiles.size} .kbeatz-write.lock file(s) - running startup repair" }
                lockFiles.forEach { repairLockFile(it) }
            }
        } catch (ex: TimeoutCancellationException) {
            val remaining = collectLockFiles()
            log.error(ex) {
                "Startup repair timed out after ${repairTimeoutSeconds}s. " +
                    "${remaining.size} lock file(s) were not repaired: $remaining. " +
                    "Affected albums will be re-indexed on the next library scan."
            }
        } finally {
            // Mark repair as complete regardless of outcome so the readiness probe
            // does not block traffic indefinitely when individual directories fail.
            repairComplete.set(true)
            log.info { "Startup repair phase complete" }
        }
    }

    @Suppress("TooGenericExceptionCaught") // non-cancellation exceptions must not abort the whole startup
    private suspend fun repairLockFile(lockFile: Path) {
        val albumDir = lockFile.parent ?: libraryRoot
        try {
            val groups = walker.walk(albumDir)
            if (groups.isNotEmpty()) {
                albumRepository.saveAll(groups.map { it.toAlbum() })
                groups.forEach { group -> saveTracksForGroup(group) }
            }
            lockFile.deleteIfExists()
            log.info { "Repaired album directory: $albumDir" }
        } catch (ex: kotlinx.coroutines.CancellationException) {
            // Propagate cancellation (e.g. from withTimeout) so the timeout is honoured.
            throw ex
        } catch (ex: Exception) {
            log.error(ex) { "Startup repair failed for $albumDir - lock file retained: $lockFile" }
        }
    }

    /**
     * Looks up the album by [AlbumGroup.rootPath], then deletes existing tracks and saves
     * fresh ones read from the FLAC files.
     *
     * Logs a WARN and returns early if the album cannot be found in the DB after [saveAll].
     * This should not happen in normal operation and indicates a natural-key mismatch or
     * data race; the WARN provides an observable signal instead of silently dropping tracks.
     */
    private suspend fun saveTracksForGroup(group: AlbumGroup) {
        val savedAlbum = albumRepository.findByDirectoryPath(group.rootPath.toString())
        if (savedAlbum == null) {
            log.warn {
                "track_save_skip rootPath=${group.rootPath} " +
                    "albumArtist=${group.albumArtist.sanitizeForLog()} " +
                    "albumTitle=${group.albumTitle.sanitizeForLog()} " +
                    "reason=album_not_found_in_db_after_saveAll - tracks will not be indexed"
            }
            return
        }
        val tracks = group.flacPaths.mapNotNull { readTrack(it, savedAlbum.id, group.rootPath) }
        trackRepository.deleteByAlbumId(savedAlbum.id)
        if (tracks.isNotEmpty()) {
            trackRepository.saveAll(tracks)
        }
    }

    private fun collectLockFiles(): List<Path> {
        val result = mutableListOf<Path>()
        Files.walkFileTree(libraryRoot, object : SimpleFileVisitor<Path>() {
            override fun visitFile(file: Path, attrs: BasicFileAttributes): FileVisitResult {
                if (file.fileName.toString() == WRITE_LOCK_FILENAME) result.add(file)
                return FileVisitResult.CONTINUE
            }

            override fun visitFileFailed(file: Path, exc: IOException): FileVisitResult {
                log.warn { "Skipping inaccessible path during lock file scan: $file (${exc.message})" }
                return FileVisitResult.CONTINUE
            }
        })
        return result
    }

    @Suppress("TooGenericExceptionCaught") // intentional: any scan failure transitions to FAILED
    private suspend fun runScan() {
        try {
            log.info { "Library scan started: $libraryRoot" }
            val groups = walker.walk(libraryRoot)
            totalAlbums.set(groups.size.toLong())
            log.info { "Discovered ${groups.size} album groups - indexing..." }

            groups.forEach { group -> indexAlbum(group) }

            completedAt.set(Clock.System.now())
            state.set(ScanState.COMPLETE)
            val indexed = scannedAlbums.get()
            val errCount = totalScanErrors.get()
            if (errCount > 0) {
                log.info { "Library scan complete: $indexed albums indexed, $errCount album(s) with errors" }
            } else {
                log.info { "Library scan complete: $indexed albums indexed" }
            }
        } catch (ex: Exception) {
            val msg = ex.message ?: ex::class.simpleName ?: "Unknown error"
            errorMessage.set(msg)
            completedAt.set(Clock.System.now())
            state.set(ScanState.FAILED)
            log.error(ex) { "Library scan FAILED: $msg" }
        }
    }

    @Suppress("TooGenericExceptionCaught") // per-album errors must not abort the whole scan
    private suspend fun indexAlbum(group: AlbumGroup) {
        try {
            albumRepository.saveAll(listOf(group.toAlbum()))
            saveTracksForGroup(group)
            scannedAlbums.incrementAndGet()
        } catch (ex: kotlinx.coroutines.CancellationException) {
            throw ex
        } catch (ex: Exception) {
            val relativeDir = libraryRoot.relativize(group.rootPath).toString()
            val reason = sanitiseReason(ex)
            val suggestion = suggestAction(ex)
            log.warn { "album_scan_error albumDir=$relativeDir reason=$reason" }
            totalScanErrors.incrementAndGet()
            if (scanErrors.size < MAX_REPORTED_ERRORS) {
                scanErrors.add(ScanErrorEntry(albumDir = relativeDir, reason = reason, suggestion = suggestion))
            }
        }
    }

    /**
     * Reads a single FLAC file and maps it to a [Track] domain object.
     *
     * Returns null if the file cannot be read (unreadable FLAC files are skipped with a WARN log),
     * or if the track's resolved path contains `..` segments indicating it lies outside
     * [albumRootPath] (skipped until multi-directory write strategy is defined in #666).
     *
     * [albumRootPath] is the album directory used to compute the track's relative [Track.path].
     * For single-disc albums this is the album directory. For multi-disc albums (disc1/, disc2/)
     * it is the parent of the disc subdirectories, so the path includes the disc subfolder.
     */
    @Suppress("TooGenericExceptionCaught") // intentional: any I/O or parse error skips the track
    private fun readTrack(flacPath: Path, albumId: Uuid, albumRootPath: Path): Track? =
        try {
            val relativePath = albumRootPath.relativize(flacPath).toString()
            if (isPathOutsideRoot(relativePath)) {
                log.warn {
                    "track_skip rootPath=$albumRootPath flacPath=$flacPath " +
                        "reason=path_outside_root - skipping until multi-directory write strategy is defined (#666)"
                }
                return null
            }
            val flacFile = FlacFile.read(KtPath(flacPath.toString()))
            val tags = flacFile.vorbisComment?.toMap()?.mapValues { (_, v) -> v.firstOrNull().orEmpty() }
                ?: emptyMap()
            val streamInfo = flacFile.metadataBlocks.filterIsInstance<FlacMetadataBlock.StreamInfo>().firstOrNull()
            val durationSeconds = streamInfo?.let { info ->
                if (info.sampleRate > 0) (info.totalSamples / info.sampleRate).toInt() else null
            }
            Track(
                id = Uuid.random(),
                albumId = albumId,
                title = tags["TITLE"]?.takeIf { it.isNotBlank() },
                trackNumber = tags["TRACKNUMBER"]?.takeIf { it.isNotBlank() },
                discNumber = tags["DISCNUMBER"]?.takeIf { it.isNotBlank() },
                trackTotal = tags["TRACKTOTAL"]?.takeIf { it.isNotBlank() },
                discTotal = tags["DISCTOTAL"]?.takeIf { it.isNotBlank() },
                artist = tags["ARTIST"]?.takeIf { it.isNotBlank() },
                composer = tags["COMPOSER"]?.takeIf { it.isNotBlank() },
                conductor = tags["CONDUCTOR"]?.takeIf { it.isNotBlank() },
                ensemble = tags["ENSEMBLE"]?.takeIf { it.isNotBlank() },
                durationSeconds = durationSeconds,
                path = relativePath,
                images = null,
                extraTags = null,
            )
        } catch (ex: Exception) {
            log.warn(ex) { "track_scan_error flacPath=$flacPath - skipping track" }
            null
        }

    /**
     * Returns true when a relativized track path contains `..` segments, indicating the track
     * file lives outside the album root directory.
     *
     * This happens when [LibraryWalker] merges sibling directories into one [AlbumGroup] during
     * deduplication (ADR-010): all directories for the same release share a single DB row, but
     * only the shallowest directory is stored as `directoryPath`. Tracks from secondary
     * directories relativize against the primary root with leading `..` segments.
     *
     * Storing such paths would break any feature that resolves `Track.path` relative to
     * `Album.directoryPath` (CLI `tag` command, future playback). Issue #666 tracks the
     * multi-directory write strategy; until then these tracks are skipped.
     */
    internal fun isPathOutsideRoot(relativePath: String): Boolean =
        relativePath == ".." || relativePath.startsWith("../") || relativePath.contains("/../")

    /**
     * Returns a short, human-readable error reason stripped of absolute paths,
     * Java class names, and stack trace fragments.
     */
    private fun sanitiseReason(ex: Exception): String =
        when {
            ex.message?.contains("permission denied", ignoreCase = true) == true ||
                ex.message?.contains("access is denied", ignoreCase = true) == true -> "Permission denied"
            ex.message?.contains("no such file", ignoreCase = true) == true ||
                ex.message?.contains("does not exist", ignoreCase = true) == true -> "File not found"
            ex.message?.contains("flac", ignoreCase = true) == true -> "FLAC header unreadable"
            ex.message?.contains("id file", ignoreCase = true) == true ||
                ex.message?.contains("idfile", ignoreCase = true) == true -> "ID file missing or malformed"
            else -> "Album could not be indexed"
        }

    /**
     * Returns an actionable suggestion based on the exception type.
     */
    private fun suggestAction(ex: Exception): String =
        when {
            ex.message?.contains("permission denied", ignoreCase = true) == true ||
                ex.message?.contains("access is denied", ignoreCase = true) == true ->
                "Check file permissions"
            ex.message?.contains("flac", ignoreCase = true) == true ->
                "FLAC header may be corrupt - re-rip or restore from backup"
            ex.message?.contains("id file", ignoreCase = true) == true ||
                ex.message?.contains("idfile", ignoreCase = true) == true ->
                "Add an id.txt file to the album directory"
            else -> "Check file permissions or FLAC integrity"
        }

    companion object {
        /**
         * Default timeout for the startup write-lock repair scan in seconds (issue #372).
         * Configurable via `catalog.repair.timeoutSeconds` in application.conf.
         */
        @Suppress("MagicNumber") // 60s default per ops spec in issue #372
        const val DEFAULT_REPAIR_TIMEOUT_SECONDS: Long = 60L

        /**
         * Maximum length for the country column, matching the VARCHAR(100) in AlbumsTable.
         * Values longer than this are truncated in [AlbumGroup.toAlbum] with a WARN log.
         */
        const val COUNTRY_MAX_LENGTH: Int = 100

        /**
         * Maximum length for the media_format column, matching the VARCHAR(500) in AlbumsTable.
         * Values longer than this are truncated in [AlbumGroup.toAlbum] with a WARN log.
         */
        const val MEDIA_FORMAT_MAX_LENGTH: Int = 500

        /**
         * Maps a [AlbumGroup] from the walker to an [Album] suitable for persistence.
         *
         * If [existingId] is supplied (looked up by natural key from the repository), it is reused
         * so that the album UUID remains stable across rescans and bookmarked UI URLs stay valid.
         * A fresh [Uuid.random] is assigned only for genuinely new albums (where [existingId] is null).
         *
         * [Album.mergedDirectories] is populated from [AlbumGroup.sourceDirs] excluding the primary
         * [AlbumGroup.rootPath]. This allows [TagWriteService] to write tags to all directories that
         * were merged during deduplication (issue #666).
         */
        fun AlbumGroup.toAlbum(existingId: Uuid? = null): Album {
            val countryValue = country?.let { raw ->
                if (raw.length > COUNTRY_MAX_LENGTH) {
                    log.warn {
                        "COUNTRY tag truncated albumDir=$rootPath " +
                            "originalLength=${raw.length} maxLength=$COUNTRY_MAX_LENGTH"
                    }
                    raw.take(COUNTRY_MAX_LENGTH)
                } else raw
            }
            val mediaFormatValue = mediaFormat?.let { raw ->
                if (raw.length > MEDIA_FORMAT_MAX_LENGTH) {
                    log.warn {
                        "MEDIA tag truncated albumDir=$rootPath " +
                            "originalLength=${raw.length} maxLength=$MEDIA_FORMAT_MAX_LENGTH"
                    }
                    raw.take(MEDIA_FORMAT_MAX_LENGTH)
                } else raw
            }
            return Album(
                id = existingId ?: Uuid.random(),
                albumArtist = albumArtist,
                album = albumTitle,
                date = date,
                genre = null,
                label = null,
                catalogNumber = null,
                composer = null,
                conductor = null,
                ensemble = null,
                country = countryValue,
                mediaFormat = mediaFormatValue,
                discogsId = null,
                directoryPath = rootPath.toString(),
                extraTags = null,
                images = null,
                mergedDirectories = sourceDirs
                    .map { it.toString() }
                    .filterNot { it == rootPath.toString() },
            )
        }
    }
}
