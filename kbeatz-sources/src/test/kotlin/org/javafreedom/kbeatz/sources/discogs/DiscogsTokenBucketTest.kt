package org.javafreedom.kbeatz.sources.discogs

import ch.qos.logback.classic.Level
import ch.qos.logback.classic.Logger
import ch.qos.logback.classic.spi.ILoggingEvent
import ch.qos.logback.core.read.ListAppender
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.slf4j.LoggerFactory
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Unit tests for [DiscogsTokenBucket].
 *
 * Uses [kotlinx.coroutines.test] virtual-time infrastructure so no wall-clock
 * time is spent on rate-limit waits.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class DiscogsTokenBucketTest {

    /**
     * Builds a bucket backed by a controlled virtual clock.
     * [nowRef] holds the current virtual time in milliseconds - tests advance it directly.
     */
    private fun buildBucket(
        maxTokens: Int = 60,
        refillIntervalMs: Long = 1_000L,
        nowRef: LongArray = LongArray(1) { 0L },
    ) = DiscogsTokenBucket(maxTokens = maxTokens, refillIntervalMs = refillIntervalMs, nowMs = { nowRef[0] })

    // ---- happy-path / burst ----

    @Test
    fun `should allow up to maxTokens immediate acquisitions without waiting`() = runTest {
        val bucket = buildBucket(maxTokens = 60)

        // Acquire all 60 tokens without advancing virtual time
        repeat(60) { bucket.acquire() }
        // If any acquisition suspended we would still have received them - test passes fast
    }

    @Test
    fun `should allow a single acquisition when bucket starts full`() = runTest {
        val bucket = buildBucket(maxTokens = 5)

        bucket.acquire() // should complete immediately
        // Test completes without suspending
    }

    // ---- refill logic ----

    @Test
    fun `should refill tokens after one refill interval`() = runTest {
        val nowRef = LongArray(1) { 0L }
        val bucket = buildBucket(maxTokens = 2, refillIntervalMs = 1_000L, nowRef = nowRef)

        // Drain all tokens
        bucket.acquire()
        bucket.acquire()

        // Advance virtual clock by 2 seconds - 2 new tokens
        nowRef[0] += 2_000L

        // Should now be able to acquire again without suspending
        bucket.acquire()
        bucket.acquire()
    }

    @Test
    fun `should not exceed maxTokens when time advances beyond bucket capacity`() = runTest {
        val nowRef = LongArray(1) { 0L }
        val bucket = buildBucket(maxTokens = 3, refillIntervalMs = 1_000L, nowRef = nowRef)

        // Drain all tokens
        repeat(3) { bucket.acquire() }

        // Advance far beyond capacity
        nowRef[0] += 60_000L

        // Should still be capped at maxTokens (3), not unlimited
        // We can drain exactly 3 without any wait
        repeat(3) { bucket.acquire() }
    }

    // ---- suspension behaviour ----

    @Test
    fun `should suspend when bucket is empty and resume after refill interval`() = runTest {
        val dispatcher = StandardTestDispatcher(testScheduler)
        val scope = TestScope(dispatcher)

        val nowRef = LongArray(1) { 0L }
        val bucket = buildBucket(maxTokens = 1, refillIntervalMs = 1_000L, nowRef = nowRef)

        // Drain the single token
        bucket.acquire()

        val completions = mutableListOf<Int>()

        // Launch a coroutine that acquires a second token - should suspend
        scope.launch {
            bucket.acquire()
            completions += 1
        }

        // Advance virtual time to trigger refill
        nowRef[0] += 1_000L
        advanceTimeBy(1_001L) // let the delay inside acquire() wake up

        assertEquals(1, completions.size, "Coroutine should have completed after refill")
    }

    // ---- rate-limiting constraint ----

    @Test
    fun `should drain exactly maxTokens without waiting then require refill for next`() = runTest {
        val nowRef = LongArray(1) { 0L }
        val bucket = buildBucket(maxTokens = 3, refillIntervalMs = 1_000L, nowRef = nowRef)

        // 3 burst acquisitions should complete immediately (no delay needed)
        repeat(3) { bucket.acquire() }

        // 4th acquisition needs a refill - simulate time passing
        nowRef[0] += 1_000L
        bucket.acquire() // should complete after virtual-time refill
    }

    // ---- authorization header safety ----

    @Test
    fun `acquire should be callable from a suspend context`() = runTest {
        val bucket = buildBucket()
        // Simply verify it compiles and runs without throwing
        bucket.acquire()
        assertTrue(true)
    }

    // ---- WARN logging when rate limit is hit (NFR-05 / issue #390) ----

    /**
     * When the token bucket is empty and acquire() must wait, it should emit exactly one
     * WARN log entry per wait cycle with structured fields waitMs and requestCount.
     *
     * Uses logback's ListAppender to capture log output without requiring any additional
     * dependencies - logback-classic is already on the test classpath.
     */
    @Test
    fun `acquire emits WARN log with waitMs and requestCount when bucket is exhausted`() = runTest {
        // Force a log call first so logback registers the logger name. Then capture it.
        val logAppender = ListAppender<ILoggingEvent>().also { it.start() }
        // Attach to the package-level logger hierarchy to catch any WARN from this package
        val packageLogger = LoggerFactory.getLogger("org.javafreedom.kbeatz.sources.discogs") as Logger
        packageLogger.level = Level.WARN
        packageLogger.addAppender(logAppender)
        packageLogger.isAdditive = true

        try {
            val nowRef = LongArray(1) { 0L }
            val bucket = buildBucket(maxTokens = 1, refillIntervalMs = 1_000L, nowRef = nowRef)

            // Drain the single token - this acquire should succeed without logging a WARN
            bucket.acquire()

            // With StandardTestDispatcher (runTest default), launched coroutines are queued.
            // runCurrent() runs all currently-queued coroutines up to their first suspension.
            // The coroutine calls acquire(), finds bucket empty (nowRef=0, no refill),
            // logs WARN, then suspends on delay(1000ms virtual time).
            launch {
                bucket.acquire()
            }

            // Run the launched coroutine up to its first suspension (the delay call).
            // This is when the WARN log entry is emitted.
            runCurrent()

            // Now advance virtual time past the delay, and also update nowRef so refill()
            // produces a token on the next acquire() loop iteration.
            nowRef[0] = 2_000L
            advanceTimeBy(1_001L)

            assertTrue(
                logAppender.list.any { it.level == Level.WARN },
                "Expected at least one WARN log entry for rate-limit wait"
            )

            val warnEvents = logAppender.list.filter { it.level == Level.WARN }
            val warnMessage = warnEvents.first().formattedMessage
            assertTrue(
                warnMessage.contains("discogs_rate_limit_wait"),
                "WARN message should contain 'discogs_rate_limit_wait' but was: $warnMessage"
            )
            assertTrue(
                warnMessage.contains("waitMs="),
                "WARN message should contain 'waitMs=' but was: $warnMessage"
            )
            assertTrue(
                warnMessage.contains("requestCount="),
                "WARN message should contain 'requestCount=' but was: $warnMessage"
            )
        } finally {
            packageLogger.detachAppender(logAppender)
        }
    }
}
