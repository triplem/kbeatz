package org.javafreedom.kbeatz.sources.discogs

import org.javafreedom.kbeatz.sources.Label
import org.javafreedom.kbeatz.sources.ReleaseArtist
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertNotNull

class DiscogsReleaseToDomainTest {

    private val minimalRelease = DiscogsRelease(id = "12345", title = "Test Album")

    @Test
    fun `should map id and title correctly`() {
        val domain = minimalRelease.toDomain()

        assertEquals("12345", domain.sourceId)
        assertEquals("discogs", domain.sourceName)
        assertEquals("Test Album", domain.title)
    }

    @Test
    fun `should map primary artists preserving join and suppressing role`() {
        val release = minimalRelease.copy(
            artists = listOf(
                DiscogsArtist(id = "1", name = "Beethoven", role = "Main Artist", join = "&"),
                DiscogsArtist(id = "2", name = "Brahms", role = "Main Artist", join = null),
            ),
        )

        val domain = release.toDomain()

        assertEquals(2, domain.artists.size)
        assertEquals(ReleaseArtist(id = "1", name = "Beethoven", role = null, join = "&"), domain.artists[0])
        assertEquals(ReleaseArtist(id = "2", name = "Brahms", role = null, join = null), domain.artists[1])
    }

    @Test
    fun `should map classical extraArtist roles Composed By, Conductor and Orchestra`() {
        val release = minimalRelease.copy(
            extraartists = listOf(
                DiscogsArtist(id = "10", name = "Beethoven", role = "Composed By"),
                DiscogsArtist(id = "11", name = "Karajan", role = "Conductor"),
                DiscogsArtist(id = "12", name = "Berlin Phil", role = "Orchestra"),
            ),
        )

        val domain = release.toDomain()

        assertEquals(3, domain.extraArtists.size)
        assertEquals("Composed By", domain.extraArtists[0].role)
        assertEquals("Conductor", domain.extraArtists[1].role)
        assertEquals("Orchestra", domain.extraArtists[2].role)
    }

    @Test
    fun `should extract barcode from identifiers`() {
        val release = minimalRelease.copy(
            identifiers = listOf(
                DiscogsIdentifier(type = "ASIN", value = "B0001234"),
                DiscogsIdentifier(type = "Barcode", value = "0190295408770"),
            ),
        )

        val domain = release.toDomain()

        assertEquals("0190295408770", domain.barcode)
    }

    @Test
    fun `should return null barcode when no Barcode identifier present`() {
        val release = minimalRelease.copy(
            identifiers = listOf(DiscogsIdentifier(type = "ASIN", value = "B0001234")),
        )

        val domain = release.toDomain()

        assertNull(domain.barcode)
    }

    @Test
    fun `should return null barcode when identifiers list is null`() {
        val domain = minimalRelease.toDomain()

        assertNull(domain.barcode)
    }

    @Test
    fun `should parse valid released date`() {
        val release = minimalRelease.copy(released = "2005-06-15")

        val domain = release.toDomain()

        assertNotNull(domain.released)
        assertEquals(2005, domain.released!!.year)
        assertEquals(6, domain.released!!.monthNumber)
        assertEquals(15, domain.released!!.dayOfMonth)
    }

    @Test
    fun `should return null released when date string is null`() {
        val domain = minimalRelease.toDomain()

        assertNull(domain.released)
    }

    @Test
    fun `should return null released when date string is blank`() {
        val release = minimalRelease.copy(released = "   ")

        val domain = release.toDomain()

        assertNull(domain.released)
    }

    @Test
    fun `should return null released when date format is unparseable`() {
        val release = minimalRelease.copy(released = "2005")

        val domain = release.toDomain()

        // "2005" alone is not a valid LocalDate — toDomain must not throw
        assertNull(domain.released)
    }

    @Test
    fun `should map labels to domain Label`() {
        val release = minimalRelease.copy(
            labels = listOf(
                DiscogsLabel(name = "Deutsche Grammophon", catno = "DG-001"),
            ),
        )

        val domain = release.toDomain()

        assertEquals(listOf(Label("Deutsche Grammophon", "DG-001")), domain.labels)
    }

    @Test
    fun `should map tracklist including per-track extraArtists`() {
        val release = minimalRelease.copy(
            tracklist = listOf(
                DiscogsTrack(
                    position = "A1",
                    title = "Symphony No. 5",
                    duration = "7:15",
                    extraartists = listOf(DiscogsArtist(id = "11", name = "Karajan", role = "Conductor")),
                ),
            ),
        )

        val domain = release.toDomain()

        assertEquals(1, domain.tracklist.size)
        val track = domain.tracklist[0]
        assertEquals("A1", track.position)
        assertEquals("Symphony No. 5", track.title)
        assertEquals("7:15", track.duration)
        assertEquals(1, track.extraArtists.size)
        assertEquals("Conductor", track.extraArtists[0].role)
    }

    @Test
    fun `should map images to ReleaseImage`() {
        val release = minimalRelease.copy(
            images = listOf(
                DiscogsImage(type = "primary", uri = "https://img.discogs.com/cover.jpg", width = 600, height = 600),
            ),
        )

        val domain = release.toDomain()

        assertEquals(1, domain.images.size)
        assertEquals("primary", domain.images[0].type)
        assertEquals("https://img.discogs.com/cover.jpg", domain.images[0].uri)
        assertEquals(600, domain.images[0].width)
        assertEquals(600, domain.images[0].height)
    }

    @Test
    fun `should map master_url and resource_url`() {
        val release = minimalRelease.copy(
            masterUrl = "https://api.discogs.com/masters/1234",
            resourceUrl = "https://api.discogs.com/releases/12345",
        )

        val domain = release.toDomain()

        assertEquals("https://api.discogs.com/masters/1234", domain.masterUrl)
        assertEquals("https://api.discogs.com/releases/12345", domain.resourceUrl)
    }
}
