package org.javafreedom.kbeatz.catalog.application.service

import io.github.oshai.kotlinlogging.KotlinLogging
import java.io.IOException
import java.nio.file.FileVisitResult
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.SimpleFileVisitor
import java.nio.file.attribute.BasicFileAttributes
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.atomic.AtomicReference
import kotlin.coroutines.CoroutineContext
import kotlin.io.path.deleteIfExists
import kotlin.uuid.Uuid
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.javafreedom.kbeatz.catalog.domain.model.Album
import org.javafreedom.kbeatz.catalog.domain.model.AlbumGroup
import org.javafreedom.kbeatz.catalog.domain.model.ScanState
import org.javafreedom.kbeatz.catalog.domain.model.ScanStatus
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
) {
    private val scanScope = CoroutineScope(SupervisorJob() + scanDispatcher)
    private val state = AtomicReference(ScanState.IDLE)
    private val scannedAlbums = AtomicLong(0L)
    private val totalAlbums = AtomicLong(0L)
    private val errorMessage = AtomicReference<String?>(null)

    /** Returns a snapshot of the current scan state. */
    fun status(): ScanStatus = ScanStatus(
        state = state.get(),
        scannedAlbums = scannedAlbums.get(),
        totalAlbums = totalAlbums.get(),
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
    @Suppress("TooGenericExceptionCaught") // individual lock repairs must not abort the whole startup
    suspend fun repairOnStartup() {
        val lockFiles = collectLockFiles()
        if (lockFiles.isEmpty()) {
            log.info { "No .kbeatz-write.lock files found — skipping startup repair" }
            return
        }

        log.info { "Found ${lockFiles.size} .kbeatz-write.lock file(s) — running startup repair" }
        lockFiles.forEach { lockFile ->
            val albumDir = lockFile.parent ?: libraryRoot
            try {
                val groups = walker.walk(albumDir)
                if (groups.isNotEmpty()) {
                    albumRepository.saveAll(groups.map { it.toAlbum() })
                }
                lockFile.deleteIfExists()
                log.info { "Repaired album directory: $albumDir" }
            } catch (ex: Exception) {
                log.error(ex) { "Startup repair failed for $albumDir — lock file retained: $lockFile" }
            }
        }
    }

    private fun collectLockFiles(): List<Path> {
        val result = mutableListOf<Path>()
        Files.walkFileTree(libraryRoot, object : SimpleFileVisitor<Path>() {
            override fun visitFile(file: Path, attrs: BasicFileAttributes): FileVisitResult {
                if (file.fileName.toString() == LOCK_FILE_NAME) result.add(file)
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

            state.set(ScanState.COMPLETE)
            log.info { "Library scan complete: ${scannedAlbums.get()} albums indexed" }
        } catch (ex: Exception) {
            val msg = ex.message ?: ex::class.simpleName ?: "Unknown error"
            errorMessage.set(msg)
            state.set(ScanState.FAILED)
            log.error(ex) { "Library scan FAILED: $msg" }
        }
    }

    companion object {
        /** Name of the write-lock sentinel file created by the FLAC tagger during writes. */
        const val LOCK_FILE_NAME = ".kbeatz-write.lock"

        /**
         * Maps a [AlbumGroup] from the walker to an [Album] suitable for persistence.
         *
         * A fresh [Uuid] is assigned to each discovered album. On re-scans, [AlbumRepository.saveAll]
         * uses the `(albumArtist, album, albumDate, directoryPath)` unique constraint to upsert rather
         * than duplicate. The ID is stable as long as the same unique key is present in H2.
         *
         * Note: This is a simplification for v1. The upsert strategy (lookup by unique key, reuse
         * existing UUID) will be addressed in a follow-up story when the detail endpoint is added.
         */
        fun AlbumGroup.toAlbum(): Album = Album(
            id = Uuid.random(),
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
