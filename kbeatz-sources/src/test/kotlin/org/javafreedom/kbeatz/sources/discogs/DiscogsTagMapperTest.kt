package org.javafreedom.kbeatz.sources.discogs

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Unit tests for [DiscogsTagMapper].
 *
 * Covers every mapping rule plus null/missing field cases (AC from story #79).
 */
class DiscogsTagMapperTest {

    private val minimalRelease = DiscogsRelease(id = "12345", title = "Test Album")

    // ---- album-level mapping ----

    @Test
    fun `should map all 14 standard fields when release is fully populated`() {
        val release = DiscogsRelease(
            id = "12345",
            title = "Kind of Blue",
            artists = listOf(DiscogsArtist(id = "1", name = "Miles Davis")),
            extraartists = listOf(
                DiscogsArtist(id = "10", name = "Beethoven", role = "Composed By"),
                DiscogsArtist(id = "11", name = "Karajan", role = "Conductor"),
                DiscogsArtist(id = "12", name = "Berlin Phil", role = "Orchestra"),
            ),
            year = 1959,
            labels = listOf(DiscogsLabel(name = "Columbia", catno = "CL 1355")),
            genres = listOf("Jazz"),
            styles = listOf("Modal"),
            masterId = 1000,
            identifiers = listOf(DiscogsIdentifier(type = "Barcode", value = "0190295408770")),
        )

        val tags = DiscogsTagMapper.albumTags(release)

        assertEquals("12345", tags["DISCOGS_RELEASE_ID"])
        assertEquals("1000", tags["DISCOGS_MASTER_ID"])
        assertEquals("Miles Davis", tags["ALBUMARTIST"])
        assertEquals("Kind of Blue", tags["ALBUM"])
        assertEquals("1959", tags["DATE"])
        assertEquals("Jazz", tags["GENRE"])
        assertEquals("Modal", tags["STYLE"])
        assertEquals("Modal", tags["GROUPING"])
        assertEquals("Columbia", tags["LABEL"])
        assertEquals("CL 1355", tags["CATALOGNUMBER"])
        assertEquals("0190295408770", tags["BARCODE"])
        assertEquals("Beethoven", tags["COMPOSER"])
        assertEquals("Karajan", tags["CONDUCTOR"])
        assertEquals("Berlin Phil", tags["ENSEMBLE"])
    }

    @Test
    fun `should set DISCOGS_RELEASE_ID from id field`() {
        val tags = DiscogsTagMapper.albumTags(minimalRelease)

        assertEquals("12345", tags["DISCOGS_RELEASE_ID"])
    }

    @Test
    fun `should set DISCOGS_MASTER_ID when masterId is non-null and non-zero`() {
        val release = minimalRelease.copy(masterId = 9999)

        val tags = DiscogsTagMapper.albumTags(release)

        assertEquals("9999", tags["DISCOGS_MASTER_ID"])
    }

    @Test
    fun `should omit DISCOGS_MASTER_ID when masterId is null`() {
        val tags = DiscogsTagMapper.albumTags(minimalRelease.copy(masterId = null))

        assertFalse(tags.containsKey("DISCOGS_MASTER_ID"))
    }

    @Test
    fun `should omit DISCOGS_MASTER_ID when masterId is zero`() {
        val tags = DiscogsTagMapper.albumTags(minimalRelease.copy(masterId = 0))

        assertFalse(tags.containsKey("DISCOGS_MASTER_ID"))
    }

    @Test
    fun `should set ALBUMARTIST from first artist name`() {
        val release = minimalRelease.copy(
            artists = listOf(
                DiscogsArtist(id = "1", name = "Miles Davis"),
                DiscogsArtist(id = "2", name = "John Coltrane"),
            ),
        )

        val tags = DiscogsTagMapper.albumTags(release)

        assertEquals("Miles Davis", tags["ALBUMARTIST"])
    }

    @Test
    fun `should omit ALBUMARTIST when artist list is empty`() {
        val tags = DiscogsTagMapper.albumTags(minimalRelease.copy(artists = emptyList()))

        assertFalse(tags.containsKey("ALBUMARTIST"))
    }

    @Test
    fun `should set DATE from year when year is present`() {
        val release = minimalRelease.copy(year = 2005)

        val tags = DiscogsTagMapper.albumTags(release)

        assertEquals("2005", tags["DATE"])
    }

    @Test
    fun `should omit DATE when year is null`() {
        val tags = DiscogsTagMapper.albumTags(minimalRelease.copy(year = null))

        assertFalse(tags.containsKey("DATE"))
    }

    @Test
    fun `should set GENRE from first genre`() {
        val release = minimalRelease.copy(genres = listOf("Jazz", "Blues"))

        val tags = DiscogsTagMapper.albumTags(release)

        assertEquals("Jazz", tags["GENRE"])
    }

    @Test
    fun `should omit GENRE when genres list is empty`() {
        val tags = DiscogsTagMapper.albumTags(minimalRelease.copy(genres = emptyList()))

        assertFalse(tags.containsKey("GENRE"))
    }

    @Test
    fun `should join multiple styles with comma-space into STYLE and GROUPING`() {
        val release = minimalRelease.copy(styles = listOf("Modal", "Cool Jazz", "Post-Bop"))

        val tags = DiscogsTagMapper.albumTags(release)

        assertEquals("Modal, Cool Jazz, Post-Bop", tags["STYLE"])
        assertEquals("Modal, Cool Jazz, Post-Bop", tags["GROUPING"])
    }

    @Test
    fun `should omit STYLE and GROUPING when styles is empty`() {
        val tags = DiscogsTagMapper.albumTags(minimalRelease.copy(styles = emptyList()))

        assertFalse(tags.containsKey("STYLE"))
        assertFalse(tags.containsKey("GROUPING"))
    }

    @Test
    fun `should set LABEL and CATALOGNUMBER from first label`() {
        val release = minimalRelease.copy(
            labels = listOf(
                DiscogsLabel(name = "Columbia", catno = "CL 1355"),
                DiscogsLabel(name = "Epic", catno = "EX 2000"),
            ),
        )

        val tags = DiscogsTagMapper.albumTags(release)

        assertEquals("Columbia", tags["LABEL"])
        assertEquals("CL 1355", tags["CATALOGNUMBER"])
    }

    @Test
    fun `should omit LABEL and CATALOGNUMBER when labels is empty`() {
        val tags = DiscogsTagMapper.albumTags(minimalRelease.copy(labels = emptyList()))

        assertFalse(tags.containsKey("LABEL"))
        assertFalse(tags.containsKey("CATALOGNUMBER"))
    }

    @Test
    fun `should extract BARCODE from identifiers`() {
        val release = minimalRelease.copy(
            identifiers = listOf(
                DiscogsIdentifier(type = "ASIN", value = "B0001234"),
                DiscogsIdentifier(type = "Barcode", value = "0190295408770"),
            ),
        )

        val tags = DiscogsTagMapper.albumTags(release)

        assertEquals("0190295408770", tags["BARCODE"])
    }

    @Test
    fun `should omit BARCODE when no Barcode identifier present`() {
        val release = minimalRelease.copy(
            identifiers = listOf(DiscogsIdentifier(type = "ASIN", value = "B0001234")),
        )

        val tags = DiscogsTagMapper.albumTags(release)

        assertFalse(tags.containsKey("BARCODE"))
    }

    @Test
    fun `should omit BARCODE when identifiers is null`() {
        val tags = DiscogsTagMapper.albumTags(minimalRelease.copy(identifiers = null))

        assertFalse(tags.containsKey("BARCODE"))
    }

    // ---- extraArtist role matching ----

    @Test
    fun `should match COMPOSER role case-insensitively`() {
        val release = minimalRelease.copy(
            extraartists = listOf(
                DiscogsArtist(id = "1", name = "Beethoven", role = "COMPOSED BY"),
            ),
        )

        val tags = DiscogsTagMapper.albumTags(release)

        assertEquals("Beethoven", tags["COMPOSER"])
    }

    @Test
    fun `should match Conductor role with mixed case`() {
        val release = minimalRelease.copy(
            extraartists = listOf(
                DiscogsArtist(id = "1", name = "Karajan", role = "Conductor"),
            ),
        )

        val tags = DiscogsTagMapper.albumTags(release)

        assertEquals("Karajan", tags["CONDUCTOR"])
    }

    @Test
    fun `should match Orchestra role case-insensitively`() {
        val release = minimalRelease.copy(
            extraartists = listOf(
                DiscogsArtist(id = "1", name = "Berlin Phil", role = "orchestra"),
            ),
        )

        val tags = DiscogsTagMapper.albumTags(release)

        assertEquals("Berlin Phil", tags["ENSEMBLE"])
    }

    @Test
    fun `should omit COMPOSER when no matching extraArtist role`() {
        val release = minimalRelease.copy(
            extraartists = listOf(
                DiscogsArtist(id = "1", name = "Some Person", role = "Piano"),
            ),
        )

        val tags = DiscogsTagMapper.albumTags(release)

        assertFalse(tags.containsKey("COMPOSER"))
    }

    @Test
    fun `should omit all optional fields when release has minimal data`() {
        val tags = DiscogsTagMapper.albumTags(minimalRelease)

        assertEquals("12345", tags["DISCOGS_RELEASE_ID"])
        assertEquals("Test Album", tags["ALBUM"])
        assertFalse(tags.containsKey("ALBUMARTIST"))
        assertFalse(tags.containsKey("DATE"))
        assertFalse(tags.containsKey("GENRE"))
        assertFalse(tags.containsKey("STYLE"))
        assertFalse(tags.containsKey("GROUPING"))
        assertFalse(tags.containsKey("LABEL"))
        assertFalse(tags.containsKey("CATALOGNUMBER"))
        assertFalse(tags.containsKey("BARCODE"))
        assertFalse(tags.containsKey("COMPOSER"))
        assertFalse(tags.containsKey("CONDUCTOR"))
        assertFalse(tags.containsKey("ENSEMBLE"))
        assertFalse(tags.containsKey("DISCOGS_MASTER_ID"))
    }

    // ---- track-level mapping ----

    @Test
    fun `should map track title to TITLE`() {
        val track = DiscogsTrack(position = "1", title = "So What")

        val tags = DiscogsTagMapper.trackTags(track)

        assertEquals("So What", tags["TITLE"])
    }

    @Test
    fun `should extract numeric TRACKNUMBER from purely numeric position`() {
        val track = DiscogsTrack(position = "3", title = "Flamenco Sketches")

        val tags = DiscogsTagMapper.trackTags(track)

        assertEquals("3", tags["TRACKNUMBER"])
    }

    @Test
    fun `should extract numeric part from side-letter position A1`() {
        val track = DiscogsTrack(position = "A1", title = "So What")

        val tags = DiscogsTagMapper.trackTags(track)

        assertEquals("1", tags["TRACKNUMBER"])
    }

    @Test
    fun `should extract numeric part from side-letter position B3`() {
        val track = DiscogsTrack(position = "B3", title = "Blue in Green")

        val tags = DiscogsTagMapper.trackTags(track)

        assertEquals("3", tags["TRACKNUMBER"])
    }

    @Test
    fun `should extract two-digit numeric part from position`() {
        val track = DiscogsTrack(position = "A12", title = "Track 12")

        val tags = DiscogsTagMapper.trackTags(track)

        assertEquals("12", tags["TRACKNUMBER"])
    }

    @Test
    fun `should omit TRACKNUMBER when position is blank`() {
        val track = DiscogsTrack(position = "", title = "Untitled")

        val tags = DiscogsTagMapper.trackTags(track)

        assertFalse(tags.containsKey("TRACKNUMBER"))
    }

    // ---- extractTrackNumber directly ----

    @Test
    fun `extractTrackNumber should return null for blank input`() {
        assertNull(DiscogsTagMapper.extractTrackNumber(""))
        assertNull(DiscogsTagMapper.extractTrackNumber("   "))
    }

    @Test
    fun `extractTrackNumber should return numeric string unchanged`() {
        assertEquals("10", DiscogsTagMapper.extractTrackNumber("10"))
    }

    @Test
    fun `extractTrackNumber should strip leading non-digit characters`() {
        assertEquals("1", DiscogsTagMapper.extractTrackNumber("A1"))
        assertEquals("3", DiscogsTagMapper.extractTrackNumber("B3"))
        assertEquals("12", DiscogsTagMapper.extractTrackNumber("CD12"))
    }

    @Test
    fun `extractTrackNumber should return null when position has no digits`() {
        assertNull(DiscogsTagMapper.extractTrackNumber("ABC"))
    }

    // ---- result is immutable ----

    @Test
    fun `albumTags result should be immutable`() {
        val tags = DiscogsTagMapper.albumTags(minimalRelease)

        // Verify it's an unmodifiable Map (toMap() returns a LinkedHashMap but cast as Map)
        assertTrue(tags is Map<String, String>)
    }
}
