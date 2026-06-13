package org.javafreedom.kbeatz.sources.discogs

import io.github.oshai.kotlinlogging.KotlinLogging
import java.io.IOException
import java.nio.channels.FileChannel
import java.nio.channels.OverlappingFileLockException
import java.nio.file.Files
import java.nio.file.NoSuchFileException
import java.nio.file.Path
import java.nio.file.StandardCopyOption
import java.nio.file.StandardOpenOption.CREATE
import java.nio.file.StandardOpenOption.READ
import java.nio.file.StandardOpenOption.WRITE
import java.time.Clock
import java.time.LocalDate
import java.time.format.DateTimeParseException
import java.util.concurrent.TimeUnit
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

private val log = KotlinLogging.logger {}

private const val DAILY_IMAGE_LIMIT = 1000

/**
 * Timeout in seconds to wait for the cross-process file lock before giving up.
 * Matches the 5-second requirement from the issue acceptance criteria.
 */
private const val LOCK_TIMEOUT_SECONDS = 5L

/**
 * Daily image download quota tracker for the Discogs API (1 000 images/day).
 *
 * When [quotaFile] is provided, the quota state is persisted atomically to a JSON file
 * so that the counter survives service restarts. The date is compared in UTC.
 *
 * Resets automatically when the UTC calendar date changes. Thread-safe.
 *
 * ## Cross-process safety
 *
 * Both the catalog service and the CLI can update the quota file simultaneously.
 * Every read-modify-write cycle acquires an exclusive [java.nio.channels.FileLock] on
 * the quota file so that concurrent JVM processes do not double-spend the quota.
 * The lock is advisory (standard on Linux/macOS/Windows); direct file writes that
 * bypass FileLock (e.g. a text editor) are not coordinated - this is acceptable for
 * this use case.
 *
 * A caller that cannot acquire the lock within [LOCK_TIMEOUT_SECONDS] seconds fails
 * with [QuotaLockTimeoutException] rather than blocking indefinitely.
 *
 * ## File format
 * ```json
 * {"downloaded": 42, "date": "2026-06-07"}
 * ```
 *
 * Writes use a temp-file + atomic rename strategy so the file is never left in a
 * corrupt state even if the JVM is killed mid-write.
 *
 * @param quotaFile Optional path to the JSON persistence file. When null the quota is
 *   tracked in memory only and resets on every JVM start.
 * @param clock Clock used to obtain today's UTC date (injectable for testing).
 */
class DiscogsImageQuota(
    private val quotaFile: Path? = null,
    private val clock: Clock = Clock.systemUTC(),
) {
    private val lock = ReentrantLock()
    private var state: QuotaState = loadOrInit()

    /** Returns `true` if fewer than 1 000 images have been downloaded today (UTC). */
    fun canDownload(): Boolean = lock.withLock {
        if (quotaFile != null) {
            withFileLock(quotaFile) {
                state = reloadState() ?: state
                resetIfNewDay()
            }
        } else {
            resetIfNewDay()
        }
        state.downloaded < DAILY_IMAGE_LIMIT
    }

    /** Records one image download against today's quota. Persists to file if configured. */
    fun recordDownload() {
        lock.withLock {
            if (quotaFile != null) {
                withFileLock(quotaFile) {
                    state = reloadState() ?: state
                    resetIfNewDay()
                    state = state.copy(downloaded = state.downloaded + 1)
                    persist()
                }
            } else {
                resetIfNewDay()
                state = state.copy(downloaded = state.downloaded + 1)
            }
        }
    }

    /**
     * Returns the number of images downloaded today.
     *
     * Primarily used in tests and monitoring.
     */
    fun downloadedToday(): Int = lock.withLock {
        if (quotaFile != null) {
            withFileLock(quotaFile) {
                state = reloadState() ?: state
                resetIfNewDay()
            }
        } else {
            resetIfNewDay()
        }
        state.downloaded
    }

    /**
     * Acquires an exclusive cross-process FileLock on a **dedicated lock file** and executes [block].
     *
     * ## Race condition fixed here
     *
     * The original implementation locked the quota data file directly. However, [persist] writes
     * quota state via an atomic temp-file rename (write to `.tmp`, then `Files.move` with
     * `ATOMIC_MOVE`). An atomic rename replaces the inode: a second instance that opens the quota
     * file after the rename gets a fresh file descriptor pointing to the new inode. The `FileLock`
     * held by the first instance is on the *old* inode and does NOT block the second instance -
     * this is the ABA race that caused lost increments in the concurrent test.
     *
     * The fix is to lock a **separate, stable lock file** (`<quotaFile>.lock`) that is never
     * renamed or replaced. All instances compete for the lock on this stable path, so the lock
     * remains effective across quota-file renames.
     *
     * The lock file is opened with CREATE so it is created if it does not yet exist.
     * If the lock cannot be acquired within [LOCK_TIMEOUT_SECONDS] seconds,
     * [QuotaLockTimeoutException] is thrown.
     *
     * If another instance is already holding the lock (wait > 0 ms), a WARN is emitted:
     * `quota_lock_contention file=<path> waitMs=<n>`.
     */
    @Suppress("TooGenericExceptionCaught") // file-channel errors must not crash the caller silently
    private fun withFileLock(file: Path, block: () -> Unit) {
        val lockFile = file.resolveSibling(file.fileName.toString() + ".lock")
        Files.createDirectories(lockFile.parent)
        FileChannel.open(lockFile, READ, WRITE, CREATE).use { channel ->
            val waitStart = System.currentTimeMillis()
            val deadline = waitStart + TimeUnit.SECONDS.toMillis(LOCK_TIMEOUT_SECONDS)
            var fileLock = tryAcquireLock(channel)
            while (fileLock == null) {
                if (System.currentTimeMillis() >= deadline) {
                    throw QuotaLockTimeoutException(
                        "Could not acquire quota file lock within ${LOCK_TIMEOUT_SECONDS}s: $lockFile"
                    )
                }
                Thread.sleep(LOCK_POLL_MS)
                fileLock = tryAcquireLock(channel)
            }
            val waitMs = System.currentTimeMillis() - waitStart
            if (waitMs > 0) {
                log.warn { "quota_lock_contention file=$lockFile waitMs=$waitMs" }
            }
            fileLock.use { _ -> block() }
        }
    }

    private fun tryAcquireLock(channel: FileChannel) =
        try {
            channel.tryLock()
        } catch (_: OverlappingFileLockException) {
            null
        }

    private fun resetIfNewDay() {
        val today = LocalDate.now(clock)
        if (today != state.date) {
            log.info { "Discogs image quota reset for new UTC day: $today (was ${state.date})" }
            state = QuotaState(downloaded = 0, date = today)
            persist()
        }
    }

    /**
     * Re-reads the quota file from disk. Called inside a FileLock to get the
     * latest value written by another process.
     */
    private fun reloadState(): QuotaState? = quotaFile?.let { readFromFile(it) }

    @Suppress("TooGenericExceptionCaught") // filesystem errors during persist must not crash the caller
    private fun persist() {
        val file = quotaFile ?: return
        try {
            Files.createDirectories(file.parent)
            val json = """{"downloaded":${state.downloaded},"date":"${state.date}"}"""
            val tmp = file.resolveSibling(file.fileName.toString() + ".tmp")
            Files.writeString(tmp, json)
            Files.move(tmp, file, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
        } catch (ex: Exception) {
            log.warn(ex) { "Failed to persist Discogs image quota to $file - continuing in-memory" }
        }
    }

    private fun loadOrInit(): QuotaState {
        val file = quotaFile ?: return QuotaState(downloaded = 0, date = LocalDate.now(clock))
        return readFromFile(file) ?: QuotaState(downloaded = 0, date = LocalDate.now(clock))
    }

    private fun readFromFile(file: Path): QuotaState? =
        try {
            if (!Files.exists(file)) return null
            val json = Files.readString(file)
            val parsed = parseJson(json) ?: return null
            QuotaState(downloaded = parsed.first, date = parsed.second)
        } catch (ex: NoSuchFileException) {
            log.debug(ex) { "Discogs image quota file not found: $file - starting fresh" }
            null
        } catch (ex: IOException) {
            log.warn(ex) { "Failed to read Discogs image quota from $file - starting fresh" }
            null
        } catch (ex: DateTimeParseException) {
            log.warn(ex) { "Corrupt date in Discogs image quota file $file - starting fresh" }
            null
        }

    companion object {
        /** Polling interval in milliseconds when waiting for the cross-process file lock. */
        internal const val LOCK_POLL_MS = 50L

        /**
         * Minimal JSON parser for the quota file format `{"downloaded":N,"date":"YYYY-MM-DD"}`.
         * Returns a `Pair(downloaded, date)` or null on parse failure.
         * Avoids pulling in a JSON library dependency just for this simple structure.
         */
        internal fun parseJson(json: String): Pair<Int, LocalDate>? = runCatching {
            val downloaded = Regex(""""downloaded"\s*:\s*(\d+)""")
                .find(json)?.groupValues?.get(1)?.toInt() ?: return null
            val date = Regex(""""date"\s*:\s*"([^"]+)"""")
                .find(json)?.groupValues?.get(1) ?: return null
            downloaded to LocalDate.parse(date)
        }.getOrNull()
    }

    private data class QuotaState(val downloaded: Int, val date: LocalDate)
}

/**
 * Thrown when the cross-process file lock on the quota file cannot be acquired
 * within the configured timeout.
 *
 * Error code for structured error responses: `QUOTA_LOCK_TIMEOUT`.
 */
class QuotaLockTimeoutException(message: String) : RuntimeException(message)
