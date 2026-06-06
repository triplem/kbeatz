package org.javafreedom.kbeatz.sources.discogs

import java.nio.file.Files
import java.time.Clock
import java.time.LocalDate
import java.time.ZoneOffset
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import kotlin.test.assertEquals

/**
 * Unit tests for [DiscogsImageQuota] covering in-memory, persistence, and day-reset behaviour.
 */
class DiscogsImageQuotaTest {

    // --- in-memory (no file) ---

    @Test
    fun `canDownload returns true when quota not yet reached`() {
        val quota = DiscogsImageQuota()

        assertTrue(quota.canDownload())
    }

    @Test
    fun `canDownload returns false after 1000 recordDownload calls`() {
        val quota = DiscogsImageQuota()

        repeat(1000) { quota.recordDownload() }

        assertFalse(quota.canDownload())
    }

    @Test
    fun `canDownload returns true when fewer than 1000 downloads recorded`() {
        val quota = DiscogsImageQuota()

        repeat(999) { quota.recordDownload() }

        assertTrue(quota.canDownload())
    }

    @Test
    fun `recordDownload increments count within quota`() {
        val quota = DiscogsImageQuota()

        repeat(5) { quota.recordDownload() }

        assertTrue(quota.canDownload())
        assertEquals(5, quota.downloadedToday())
    }

    // --- UTC date reset ---

    @Test
    fun `canDownload resets to true when date changes`() {
        val fixedDate = LocalDate.of(2026, 6, 5)
        val fixedClock = Clock.fixed(
            fixedDate.atStartOfDay(ZoneOffset.UTC).toInstant(),
            ZoneOffset.UTC,
        )
        val quota = DiscogsImageQuota(clock = fixedClock)

        // Exhaust today's quota
        repeat(1000) { quota.recordDownload() }
        assertFalse(quota.canDownload())

        // Advance to next day
        val nextDay = fixedDate.plusDays(1)
        val nextDayClock = Clock.fixed(
            nextDay.atStartOfDay(ZoneOffset.UTC).toInstant(),
            ZoneOffset.UTC,
        )
        val quotaNextDay = DiscogsImageQuota(clock = nextDayClock)
        assertTrue(quotaNextDay.canDownload())
    }

    // --- JSON persistence ---

    @Test
    fun `canDownload returns true after restart when 500 were downloaded`() {
        val dir = Files.createTempDirectory("quota-test")
        val file = dir.resolve("discogs-image-quota.json")

        // Simulate first run: record 500 downloads
        val run1 = DiscogsImageQuota(quotaFile = file)
        repeat(500) { run1.recordDownload() }

        // Simulate restart
        val run2 = DiscogsImageQuota(quotaFile = file)

        assertTrue(run2.canDownload(), "After 500 downloads there should be quota remaining")
        assertEquals(500, run2.downloadedToday())
    }

    @Test
    fun `canDownload returns false after restart when 1000 were downloaded`() {
        val dir = Files.createTempDirectory("quota-test")
        val file = dir.resolve("discogs-image-quota.json")

        val run1 = DiscogsImageQuota(quotaFile = file)
        repeat(1000) { run1.recordDownload() }

        val run2 = DiscogsImageQuota(quotaFile = file)

        assertFalse(run2.canDownload(), "Quota should remain exhausted after restart")
    }

    @Test
    fun `quota resets to 0 on restart when file date is a previous day`() {
        val dir = Files.createTempDirectory("quota-test")
        val file = dir.resolve("discogs-image-quota.json")

        // Write a stale file (yesterday)
        val yesterday = LocalDate.now(Clock.systemUTC()).minusDays(1)
        Files.writeString(file, """{"downloaded":900,"date":"$yesterday"}""")

        // Load with today's clock — should reset
        val quota = DiscogsImageQuota(quotaFile = file)

        assertTrue(quota.canDownload(), "Stale date should trigger reset")
        assertEquals(0, quota.downloadedToday())
    }

    @Test
    fun `recordDownload is persisted so incremented value survives restart`() {
        val dir = Files.createTempDirectory("quota-test")
        val file = dir.resolve("discogs-image-quota.json")

        val run1 = DiscogsImageQuota(quotaFile = file)
        run1.recordDownload()
        run1.recordDownload()

        val run2 = DiscogsImageQuota(quotaFile = file)

        assertEquals(2, run2.downloadedToday(), "Two downloads should be persisted across restart")
    }

    @Test
    fun `quota starts fresh when no file exists`() {
        val dir = Files.createTempDirectory("quota-test")
        val file = dir.resolve("discogs-image-quota.json")
        // file does NOT exist

        val quota = DiscogsImageQuota(quotaFile = file)

        assertTrue(quota.canDownload())
        assertEquals(0, quota.downloadedToday())
    }

    // --- JSON parsing ---

    @Test
    fun `parseJson returns correct state for valid JSON`() {
        val state = DiscogsImageQuota.parseJson("""{"downloaded":42,"date":"2026-06-07"}""")

        assertEquals(42, state?.first)
        assertEquals(LocalDate.of(2026, 6, 7), state?.second)
    }

    @Test
    fun `parseJson returns null for malformed JSON`() {
        val state = DiscogsImageQuota.parseJson("not-json")

        assertEquals(null, state)
    }

    @Test
    fun `parseJson returns null when downloaded field is missing`() {
        val state = DiscogsImageQuota.parseJson("""{"date":"2026-06-07"}""")

        assertEquals(null, state)
    }

    @Test
    fun `parseJson returns null when date field is missing`() {
        val state = DiscogsImageQuota.parseJson("""{"downloaded":10}""")

        assertEquals(null, state)
    }

    @Test
    fun `parseJson handles whitespace in JSON`() {
        val state = DiscogsImageQuota.parseJson("""{ "downloaded" : 7, "date" : "2026-01-15" }""")

        assertEquals(7, state?.first)
        assertEquals(LocalDate.of(2026, 1, 15), state?.second)
    }

    // --- boundary ---

    @Test
    fun `canDownload is true at 999 and false at 1000`() {
        val quota = DiscogsImageQuota()

        repeat(999) { quota.recordDownload() }
        assertTrue(quota.canDownload())

        quota.recordDownload()
        assertFalse(quota.canDownload())
    }
}
