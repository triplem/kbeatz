package org.javafreedom.kbeatz.sources.discogs

import io.github.oshai.kotlinlogging.KotlinLogging
import java.io.IOException
import java.nio.file.Files
import java.nio.file.NoSuchFileException
import java.nio.file.Path
import java.nio.file.StandardCopyOption
import java.time.Clock
import java.time.LocalDate
import java.time.format.DateTimeParseException
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

private val log = KotlinLogging.logger {}

private const val DAILY_IMAGE_LIMIT = 1000

/**
 * Daily image download quota tracker for the Discogs API (1 000 images/day).
 *
 * When [quotaFile] is provided, the quota state is persisted atomically to a JSON file
 * so that the counter survives service restarts. The date is compared in UTC.
 *
 * Resets automatically when the UTC calendar date changes. Thread-safe.
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
        resetIfNewDay()
        state.downloaded < DAILY_IMAGE_LIMIT
    }

    /** Records one image download against today's quota. Persists to file if configured. */
    fun recordDownload() {
        lock.withLock {
            resetIfNewDay()
            state = state.copy(downloaded = state.downloaded + 1)
            persist()
        }
    }

    /**
     * Returns the number of images downloaded today.
     *
     * Primarily used in tests and monitoring.
     */
    fun downloadedToday(): Int = lock.withLock {
        resetIfNewDay()
        state.downloaded
    }

    private fun resetIfNewDay() {
        val today = LocalDate.now(clock)
        if (today != state.date) {
            log.info { "Discogs image quota reset for new UTC day: $today (was ${state.date})" }
            state = QuotaState(downloaded = 0, date = today)
            persist()
        }
    }

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
            log.warn(ex) { "Failed to persist Discogs image quota to $file — continuing in-memory" }
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
            log.debug(ex) { "Discogs image quota file not found: $file — starting fresh" }
            null
        } catch (ex: IOException) {
            log.warn(ex) { "Failed to read Discogs image quota from $file — starting fresh" }
            null
        } catch (ex: DateTimeParseException) {
            log.warn(ex) { "Corrupt date in Discogs image quota file $file — starting fresh" }
            null
        }

    companion object {
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
