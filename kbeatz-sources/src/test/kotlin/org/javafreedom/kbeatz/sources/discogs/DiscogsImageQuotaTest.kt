package org.javafreedom.kbeatz.sources.discogs

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class DiscogsImageQuotaTest {

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

        // After 5 downloads, still able to download
        assertTrue(quota.canDownload())
    }
}
