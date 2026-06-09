package org.javafreedom.kbeatz.catalog.application.service

import io.github.oshai.kotlinlogging.KotlinLogging
import java.io.IOException
import java.nio.file.FileVisitResult
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.SimpleFileVisitor
import java.nio.file.attribute.BasicFileAttributes
import java.util.concurrent.atomic.AtomicBoolean
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
import kotlinx.datetime.Clock
import kotlinx.datetime.Instant
import org.javafreedom.kbeatz.catalog.domain.model.Album
import org.javafreedom.kbeatz.catalog.domain.model.AlbumGroup
import org.javafreedom.kbeatz.catalog.domain.model.ScanState
import org.javafreedom.kbeatz.catalog.domain.model.ScanStatus
import org.javafreedom.kbeatz.catalog.domain.model.WRITE_LOCK_FILENAME
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumRepository

private val log = KotlinLogging.logger {}

/**
 * Manages asynchronous library scanning and progress tracking.
 *
 * ## State machine
 * `IDLE → RUNNING → COMPLETE | FAILED`
 *
 * Concurrent scan guard: calling [startScan] when a scan is already [ScanState.RUNNING] logs a
 * warning and returns immediately — no duplicate scan is launched.
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
            log.warn { "Library scan already RUNNING — ignoring duplicate startScan() call" }
            return
        }

        scannedAlbums.set(0L)
        totalAlbums.set(0L)
        startedAt.set(Clock.System.now())
        completedAt.set(null)
        errorMessage.set(null)

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
            log.info { "Discovered ${groups.size} album groups — indexing..." }

            val albums = groups.map { it.toAlbum() }
            albumRepository.saveAll(albums)
            scannedAlbums.set(albums.size.toLong())

            completedAt.set(Clock.System.now())
            state.set(ScanState.COMPLETE)
            log.info { "Library scan complete: ${scannedAlbums.get()} albums indexed" }
        } catch (ex: Exception) {
            val msg = ex.message ?: ex::class.simpleName ?: "Unknown error"
            errorMessage.set(msg)
            completedAt.set(Clock.System.now())
            state.set(ScanState.FAILED)
            log.error(ex) { "Library scan FAILED: $msg" }
        }
    }

    companion object {
        /**
         * Default timeout for the startup write-lock repair scan in seconds (issue #372).
         * Configurable via `catalog.repair.timeoutSeconds` in application.conf.
         */
        @Suppress("MagicNumber") // 60s default per ops spec in issue #372
        const val DEFAULT_REPAIR_TIMEOUT_SECONDS: Long = 60L

        /**
         * Maps a [AlbumGroup] from the walker to an [Album] suitable for persistence.
         *
         * If [existingId] is supplied (looked up by natural key from the repository), it is reused
         * so that the album UUID remains stable across rescans and bookmarked UI URLs stay valid.
         * A fresh [Uuid.random] is assigned only for genuinely new albums (where [existingId] is null).
         */
        fun AlbumGroup.toAlbum(existingId: Uuid? = null): Album = Album(
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
            discogsId = null,
            directoryPath = rootPath.toString(),
            extraTags = null,
            images = null,
        )
    }
}
