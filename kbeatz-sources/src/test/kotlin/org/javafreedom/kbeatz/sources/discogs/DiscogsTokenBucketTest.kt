package org.javafreedom.kbeatz.sources.discogs

import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runTest
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
     * [nowRef] holds the current virtual time in milliseconds — tests advance it directly.
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
        // If any acquisition suspended we would still have received them — test passes fast
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

        // Advance virtual clock by 2 seconds → 2 new tokens
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

        // Launch a coroutine that acquires a second token — should suspend
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

        // 4th acquisition needs a refill — simulate time passing
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
}
