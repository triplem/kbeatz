package org.javafreedom.kbeatz.sources.discogs

import io.github.oshai.kotlinlogging.KotlinLogging
import kotlin.time.Duration.Companion.milliseconds
import kotlinx.coroutines.delay
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

private val log = KotlinLogging.logger {}

/** Minimum time between token refills (1 token per second for 60 req/min bucket). */
private const val REFILL_INTERVAL_MS = 1_000L

/** Maximum burst capacity (one full minute of requests). */
private const val MAX_TOKENS = 60

/**
 * Coroutine-friendly token-bucket rate limiter for the Discogs API (60 requests/minute).
 *
 * When the bucket is empty, [acquire] suspends the calling coroutine until a token is
 * available — it does **not** throw. One token is produced every [REFILL_INTERVAL_MS]
 * milliseconds (1 token/second), giving a sustained rate of 60 req/min.
 *
 * The bucket starts full ([MAX_TOKENS] tokens) so burst traffic up to 60 requests is
 * allowed immediately after startup before throttling begins.
 *
 * All state mutations are protected by a [Mutex] to support concurrent callers.
 *
 * ## Observability
 *
 * When the bucket is empty and a caller must wait, a WARN log entry is emitted:
 * ```
 * discogs_rate_limit_wait waitMs=<ms> requestCount=<total requests this bucket lifetime>
 * ```
 * This indicates the Discogs quota window is being exhausted and aids production diagnosis
 * of slow sync operations.
 */
class DiscogsTokenBucket(
    private val maxTokens: Int = MAX_TOKENS,
    private val refillIntervalMs: Long = REFILL_INTERVAL_MS,
    private val nowMs: () -> Long = { System.currentTimeMillis() },
) {
    private val mutex = Mutex()
    private var tokens = maxTokens
    private var lastRefillMs = nowMs()
    private var requestCount = 0

    /**
     * Acquires one token. If no token is available, suspends until the next refill tick
     * and emits a WARN log entry with the wait duration and cumulative request count.
     *
     * This is the only public API: call before every Discogs API request.
     */
    @Suppress("RedundantSuspendModifier") // false positive: calls delay() in the else-branch of the while loop
    suspend fun acquire() {
        while (true) {
            val waitMs = mutex.withLock {
                refill()
                if (tokens > 0) {
                    tokens--
                    requestCount++
                    0L
                } else {
                    refillIntervalMs
                }
            }
            if (waitMs == 0L) return
            log.warn { "discogs_rate_limit_wait waitMs=$waitMs requestCount=$requestCount" }
            delay(waitMs.milliseconds)
        }
    }

    /** Adds tokens based on elapsed time since last refill. Must be called inside [mutex]. */
    private fun refill() {
        val now = nowMs()
        val elapsed = now - lastRefillMs
        val newTokens = (elapsed / refillIntervalMs).toInt()
        if (newTokens > 0) {
            tokens = minOf(maxTokens, tokens + newTokens)
            lastRefillMs += newTokens * refillIntervalMs
        }
    }
}
