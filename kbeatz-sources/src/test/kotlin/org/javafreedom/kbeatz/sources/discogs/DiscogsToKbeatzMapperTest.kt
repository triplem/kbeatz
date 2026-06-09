package org.javafreedom.kbeatz.sources.discogs

import kotlin.time.Instant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertNotNull

/**
 * Unit tests for [DiscogsToKbeatzMapper].
 *
 * Covers position-string parsing, index-track / discSubtitle handling,
 * multi-disc track totals, and image mapping.
 */
class DiscogsToKbeatzMapperTest {

    private val fetchedAt = Instant.parse("2026-06-09T10:00:00Z")

    private val minimalRelease = DiscogsRelease(id = "12345", title = "Test Album")

    // --- parsePosition unit tests ---

    @Test
    fun `parsePosition returns null for blank position`() {
        assertNull(DiscogsToKbeatzMapper.parsePosition(""))
        assertNull(DiscogsToKbeatzMapper.parsePosition("   "))
    }

    @Test
    fun `parsePosition skips Video prefix`() {
        assertNull(DiscogsToKbeatzMapper.parsePosition("Video"))
        assertNull(DiscogsToKbeatzMapper.parsePosition("Video 1"))
    }

    @Test
    fun `parsePosition skips video lowercase prefix`() {
        assertNull(DiscogsToKbeatzMapper.parsePosition("video1"))
    }

    @Test
    fun `parsePosition skips DVD prefix`() {
        assertNull(DiscogsToKbeatzMapper.parsePosition("DVD1"))
    }

    @Test
    fun `parsePosition parses CD disc-track format`() {
        val result = DiscogsToKbeatzMapper.parsePosition("CD01-12")
        assertNotNull(result)
        assertEquals(1, result.disc)
        assertEquals(12, result.track)
    }

    @Test
    fun `parsePosition parses disc-dash-track format`() {
        val result = DiscogsToKbeatzMapper.parsePosition("1-02")
        assertNotNull(result)
        assertEquals(1, result.disc)
        assertEquals(2, result.track)
    }

    @Test
    fun `parsePosition parses multi-disc disc-dash-track`() {
        val result = DiscogsToKbeatzMapper.parsePosition("2-05")
        assertNotNull(result)
        assertEquals(2, result.disc)
        assertEquals(5, result.track)
    }

    @Test
    fun `parsePosition parses disc-dot-track format`() {
        val result = DiscogsToKbeatzMapper.parsePosition("2.05")
        assertNotNull(result)
        assertEquals(2, result.disc)
        assertEquals(5, result.track)
    }

    @Test
    fun `parsePosition parses bare integer as disc 1`() {
        val result = DiscogsToKbeatzMapper.parsePosition("3")
        assertNotNull(result)
        assertEquals(1, result.disc)
        assertEquals(3, result.track)
    }

    @Test
    fun `parsePosition parses A-side letter position as disc 1`() {
        val result = DiscogsToKbeatzMapper.parsePosition("A1")
        assertNotNull(result)
        assertEquals(1, result.disc)
        assertEquals(1, result.track)
    }

    @Test
    fun `parsePosition parses B-side letter position as disc 1`() {
        val result = DiscogsToKbeatzMapper.parsePosition("B3")
        assertNotNull(result)
        assertEquals(1, result.disc)
        assertEquals(3, result.track)
    }

    // --- multi-disc track number and total ---

    @Test
    fun `multi-disc tracks have correct discNumber and trackNumber`() {
        val release = minimalRelease.copy(
            tracklist = listOf(
                DiscogsTrack(position = "1-01", title = "Track A", duration = "3:00"),
                DiscogsTrack(position = "1-02", title = "Track B", duration = "3:00"),
                DiscogsTrack(position = "2-01", title = "Track C", duration = "3:00"),
                DiscogsTrack(position = "2-02", title = "Track D", duration = "3:00"),
            ),
        )

        val metadata = DiscogsToKbeatzMapper.map(release, fetchedAt)

        assertEquals(4, metadata.tracks.size)
        assertEquals(1, metadata.tracks[0].discNumber)
        assertEquals(1, metadata.tracks[0].trackNumber)
        assertEquals(1, metadata.tracks[1].discNumber)
        assertEquals(2, metadata.tracks[1].trackNumber)
        assertEquals(2, metadata.tracks[2].discNumber)
        assertEquals(1, metadata.tracks[2].trackNumber)
        assertEquals(2, metadata.tracks[3].discNumber)
        assertEquals(2, metadata.tracks[3].trackNumber)
    }

    @Test
    fun `discTotal equals number of distinct disc groups`() {
        val release = minimalRelease.copy(
            tracklist = listOf(
                DiscogsTrack(position = "1-01", title = "A", duration = "3:00"),
                DiscogsTrack(position = "2-01", title = "B", duration = "3:00"),
            ),
        )

        val metadata = DiscogsToKbeatzMapper.map(release, fetchedAt)

        assertEquals(2, metadata.album.discTotal)
    }

    @Test
    fun `trackTotal per disc is the count of tracks on that disc`() {
        val release = minimalRelease.copy(
            tracklist = listOf(
                DiscogsTrack(position = "1-01", title = "A", duration = "3:00"),
                DiscogsTrack(position = "1-02", title = "B", duration = "3:00"),
                DiscogsTrack(position = "2-01", title = "C", duration = "3:00"),
            ),
        )

        val metadata = DiscogsToKbeatzMapper.map(release, fetchedAt)

        assertEquals(2, metadata.tracks[0].trackTotal)
        assertEquals(2, metadata.tracks[1].trackTotal)
        assertEquals(1, metadata.tracks[2].trackTotal)
    }

    // --- index track / discSubtitle ---

    @Test
    fun `index entry not included as playable track`() {
        val release = minimalRelease.copy(
            tracklist = listOf(
                DiscogsTrack(position = "", title = "Side A", duration = null),
                DiscogsTrack(position = "A1", title = "Real Track", duration = "3:00"),
            ),
        )

        val metadata = DiscogsToKbeatzMapper.map(release, fetchedAt)

        assertEquals(1, metadata.tracks.size)
        assertEquals("Real Track", metadata.tracks[0].title)
    }

    @Test
    fun `real tracks following index entry carry discSubtitle`() {
        val release = minimalRelease.copy(
            tracklist = listOf(
                DiscogsTrack(position = "", title = "Side A", duration = null),
                DiscogsTrack(position = "A1", title = "Track One", duration = "3:00"),
                DiscogsTrack(position = "A2", title = "Track Two", duration = "4:00"),
            ),
        )

        val metadata = DiscogsToKbeatzMapper.map(release, fetchedAt)

        assertEquals("Side A", metadata.tracks[0].discSubtitle)
        assertEquals("Side A", metadata.tracks[1].discSubtitle)
    }

    @Test
    fun `tracks before any index entry have null discSubtitle`() {
        val release = minimalRelease.copy(
            tracklist = listOf(
                DiscogsTrack(position = "1", title = "Track One", duration = "3:00"),
                DiscogsTrack(position = "", title = "Side B", duration = null),
                DiscogsTrack(position = "B1", title = "Track Two", duration = "3:00"),
            ),
        )

        val metadata = DiscogsToKbeatzMapper.map(release, fetchedAt)

        assertNull(metadata.tracks[0].discSubtitle)
        assertEquals("Side B", metadata.tracks[1].discSubtitle)
    }

    // --- image mapping ---

    @Test
    fun `primary image gets pictureType 3 and localPath folder dot jpg`() {
        val release = minimalRelease.copy(
            images = listOf(
                DiscogsImage(type = "primary", uri = "https://img.discogs.com/cover.jpg", width = 600, height = 600),
            ),
        )

        val metadata = DiscogsToKbeatzMapper.map(release, fetchedAt)

        assertEquals(1, metadata.images.size)
        assertEquals(3, metadata.images[0].pictureType)
        assertEquals("folder.jpg", metadata.images[0].localPath)
        assertEquals("https://img.discogs.com/cover.jpg", metadata.images[0].sourceUri)
    }

    @Test
    fun `only first primary image gets front cover pictureType`() {
        val release = minimalRelease.copy(
            images = listOf(
                DiscogsImage(type = "primary", uri = "https://img.discogs.com/cover1.jpg", width = 600, height = 600),
                DiscogsImage(type = "primary", uri = "https://img.discogs.com/cover2.jpg", width = 600, height = 600),
            ),
        )

        val metadata = DiscogsToKbeatzMapper.map(release, fetchedAt)

        assertEquals(3, metadata.images[0].pictureType)
        assertEquals(0, metadata.images[1].pictureType)
    }

    @Test
    fun `secondary images get pictureType 0`() {
        val release = minimalRelease.copy(
            images = listOf(
                DiscogsImage(type = "secondary", uri = "https://img.discogs.com/back.jpg", width = 600, height = 600),
            ),
        )

        val metadata = DiscogsToKbeatzMapper.map(release, fetchedAt)

        assertEquals(0, metadata.images[0].pictureType)
    }

    @Test
    fun `png image gets mime type image slash png`() {
        val release = minimalRelease.copy(
            images = listOf(
                DiscogsImage(type = "primary", uri = "https://img.discogs.com/cover.png", width = 600, height = 600),
            ),
        )

        val metadata = DiscogsToKbeatzMapper.map(release, fetchedAt)

        assertEquals("image/png", metadata.images[0].mimeType)
    }

    // --- album-level fields ---

    @Test
    fun `album artist is taken from first artist`() {
        val release = minimalRelease.copy(
            artists = listOf(DiscogsArtist(id = "1", name = "Miles Davis", role = "")),
        )

        val metadata = DiscogsToKbeatzMapper.map(release, fetchedAt)

        assertEquals("Miles Davis", metadata.album.albumArtist)
    }

    @Test
    fun `date is mapped from year`() {
        val release = minimalRelease.copy(year = 1959)

        val metadata = DiscogsToKbeatzMapper.map(release, fetchedAt)

        assertEquals("1959", metadata.album.date)
    }

    @Test
    fun `barcode extracted from Barcode identifier`() {
        val release = minimalRelease.copy(
            identifiers = listOf(
                DiscogsIdentifier(type = "Barcode", value = "0190295408770"),
            ),
        )

        val metadata = DiscogsToKbeatzMapper.map(release, fetchedAt)

        assertEquals("0190295408770", metadata.album.barcode)
    }

    @Test
    fun `composer mapped from Composed By extra artist`() {
        val release = minimalRelease.copy(
            extraartists = listOf(DiscogsArtist(id = "10", name = "Beethoven", role = "Composed By")),
        )

        val metadata = DiscogsToKbeatzMapper.map(release, fetchedAt)

        assertEquals("Beethoven", metadata.album.composer)
    }

    @Test
    fun `sourceId and source are set correctly`() {
        val metadata = DiscogsToKbeatzMapper.map(minimalRelease, fetchedAt)

        assertEquals("discogs", metadata.source)
        assertEquals("12345", metadata.sourceId)
    }

    @Test
    fun `fetchedAt is preserved in output`() {
        val metadata = DiscogsToKbeatzMapper.map(minimalRelease, fetchedAt)

        assertEquals(fetchedAt, metadata.fetchedAt)
    }
}
