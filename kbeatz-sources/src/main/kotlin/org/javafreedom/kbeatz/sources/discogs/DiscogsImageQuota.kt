package org.javafreedom.kbeatz.sources.discogs

import java.time.LocalDate
import java.util.concurrent.atomic.AtomicInteger

private const val DAILY_IMAGE_LIMIT = 1000

/**
 * In-memory daily image download quota tracker for the Discogs API.
 *
 * Resets automatically when the calendar date changes. Thread-safe.
 */
class DiscogsImageQuota {

    @Volatile
    private var currentDate: LocalDate = LocalDate.now()
    private val count = AtomicInteger(0)

    /** Returns `true` if fewer than 1 000 images have been downloaded today. */
    fun canDownload(): Boolean {
        resetIfNewDay()
        return count.get() < DAILY_IMAGE_LIMIT
    }

    /** Records one image download against today's quota. */
    fun recordDownload() {
        resetIfNewDay()
        count.incrementAndGet()
    }

    private fun resetIfNewDay() {
        val today = LocalDate.now()
        if (today != currentDate) {
            synchronized(this) {
                if (today != currentDate) {
                    currentDate = today
                    count.set(0)
                }
            }
        }
    }
}
