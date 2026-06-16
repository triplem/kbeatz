package org.javafreedom.kbeatz.common.metadata

import kotlin.time.Instant
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals

class KbeatzMetadataTest {

    private val json = Json { prettyPrint = false; encodeDefaults = true }

    /** Build a 2-disc album fixture: disc 1 has 3 tracks, disc 2 has 2 tracks, with 2 images. */
    private fun twoDiscFixture(): KbeatzMetadata = KbeatzMetadata(
        schemaVersion = 1,
        source = "discogs",
        sourceId = "12345",
        fetchedAt = Instant.parse("2026-01-15T10:00:00Z"),
        album = KbeatzMetadata.Album(
            title = "The Wall",
            albumArtist = "Pink Floyd",
            date = "1979",
            genres = listOf("Rock"),
            styles = listOf("Art Rock", "Prog Rock"),
            label = "Harvest",
            catalogNumber = "SHDW 411",
            barcode = "5099902988924",
            composer = "Roger Waters",
            conductor = null,
            ensemble = null,
            discTotal = 2,
        ),
        tracks = listOf(
            KbeatzMetadata.Track(
                discNumber = 1,
                trackNumber = 1,
                trackTotal = 3,
                title = "In the Flesh?",
                artist = null,
                duration = "3:16",
                discSubtitle = null,
                originalPosition = "A1",
            ),
            KbeatzMetadata.Track(
                discNumber = 1,
                trackNumber = 2,
                trackTotal = 3,
                title = "The Thin Ice",
                artist = null,
                duration = "2:27",
                discSubtitle = null,
                originalPosition = "A2",
            ),
            KbeatzMetadata.Track(
                discNumber = 1,
                trackNumber = 3,
                trackTotal = 3,
                title = "Another Brick in the Wall, Part 1",
                artist = null,
                duration = "3:11",
                discSubtitle = null,
                originalPosition = "A3",
            ),
            KbeatzMetadata.Track(
                discNumber = 2,
                trackNumber = 1,
                trackTotal = 2,
                title = "Hey You",
                artist = null,
                duration = "4:40",
                discSubtitle = null,
                originalPosition = "C1",
            ),
            KbeatzMetadata.Track(
                discNumber = 2,
                trackNumber = 2,
                trackTotal = 2,
                title = "Is There Anybody Out There?",
                artist = null,
                duration = "2:44",
                discSubtitle = null,
                originalPosition = "C2",
            ),
        ),
        images = listOf(
            KbeatzMetadata.Image(
                pictureType = 3,
                description = "Front cover",
                mimeType = "image/jpeg",
                sourceUri = "https://img.discogs.com/abc123/front.jpg",
                localPath = "folder.jpg",
            ),
            KbeatzMetadata.Image(
                pictureType = 4,
                description = "Back cover",
                mimeType = "image/jpeg",
                sourceUri = "https://img.discogs.com/abc123/back.jpg",
                localPath = "back.jpg",
            ),
        ),
    )

    @Test
    fun `should round-trip serialization for a 2-disc album with 5 tracks and 2 images`() {
        val original = twoDiscFixture()

        val serialized = json.encodeToString(KbeatzMetadata.serializer(), original)
        val deserialized = json.decodeFromString(KbeatzMetadata.serializer(), serialized)

        assertEquals(original, deserialized)
    }

    @Test
    fun `should preserve all album fields after round-trip`() {
        val original = twoDiscFixture()

        val serialized = json.encodeToString(KbeatzMetadata.serializer(), original)
        val deserialized = json.decodeFromString(KbeatzMetadata.serializer(), serialized)

        assertEquals(original.album.title, deserialized.album.title)
        assertEquals(original.album.albumArtist, deserialized.album.albumArtist)
        assertEquals(original.album.discTotal, deserialized.album.discTotal)
        assertEquals(original.album.composer, deserialized.album.composer)
        assertEquals(original.album.genres, deserialized.album.genres)
        assertEquals(original.album.styles, deserialized.album.styles)
    }

    @Test
    fun `should preserve discNumber, trackNumber, and trackTotal for all tracks`() {
        val original = twoDiscFixture()

        val serialized = json.encodeToString(KbeatzMetadata.serializer(), original)
        val deserialized = json.decodeFromString(KbeatzMetadata.serializer(), serialized)

        assertEquals(5, deserialized.tracks.size)

        val disc1Tracks = deserialized.tracks.filter { it.discNumber == 1 }
        assertEquals(3, disc1Tracks.size)
        disc1Tracks.forEach { track -> assertEquals(3, track.trackTotal) }

        val disc2Tracks = deserialized.tracks.filter { it.discNumber == 2 }
        assertEquals(2, disc2Tracks.size)
        disc2Tracks.forEach { track -> assertEquals(2, track.trackTotal) }
    }

    @Test
    fun `should preserve discNumber 2 and trackNumber 3 for a track with originalPosition 2-03`() {
        val metadata = KbeatzMetadata(
            schemaVersion = 1,
            source = "discogs",
            sourceId = "99",
            fetchedAt = Instant.parse("2026-01-01T00:00:00Z"),
            album = KbeatzMetadata.Album(
                title = "Test Album",
                albumArtist = "Test Artist",
                date = null,
                label = null,
                catalogNumber = null,
                barcode = null,
                composer = null,
                conductor = null,
                ensemble = null,
                discTotal = 2,
            ),
            tracks = listOf(
                KbeatzMetadata.Track(
                    discNumber = 2,
                    trackNumber = 3,
                    trackTotal = 10,
                    title = "Track 2-03",
                    artist = null,
                    duration = null,
                    discSubtitle = null,
                    originalPosition = "2-03",
                ),
            ),
            images = emptyList(),
        )

        val serialized = json.encodeToString(KbeatzMetadata.serializer(), metadata)
        val deserialized = json.decodeFromString(KbeatzMetadata.serializer(), serialized)

        val track = deserialized.tracks.single()
        assertEquals(2, track.discNumber)
        assertEquals(3, track.trackNumber)
        assertEquals("2-03", track.originalPosition)
    }

    @Test
    fun `should preserve pictureType and localPath for all images`() {
        val original = twoDiscFixture()

        val serialized = json.encodeToString(KbeatzMetadata.serializer(), original)
        val deserialized = json.decodeFromString(KbeatzMetadata.serializer(), serialized)

        assertEquals(2, deserialized.images.size)
        assertEquals(3, deserialized.images[0].pictureType)
        assertEquals("folder.jpg", deserialized.images[0].localPath)
        assertEquals(4, deserialized.images[1].pictureType)
        assertEquals("back.jpg", deserialized.images[1].localPath)
    }

    @Test
    fun `should include schemaVersion 1 in serialized output`() {
        val metadata = twoDiscFixture()

        val serialized = json.encodeToString(KbeatzMetadata.serializer(), metadata)

        assert(serialized.contains("\"schemaVersion\":1")) {
            "Expected schemaVersion:1 in JSON but got: $serialized"
        }
    }

    @Test
    fun `should default discNumber to 1 when not specified`() {
        val track = KbeatzMetadata.Track(
            trackNumber = 1,
            trackTotal = 10,
            title = "First Track",
            artist = null,
            duration = null,
            discSubtitle = null,
            originalPosition = null,
        )

        assertEquals(1, track.discNumber)
    }

    @Test
    fun `should default discTotal to 1 when not specified`() {
        val album = KbeatzMetadata.Album(
            title = "Single Disc",
            albumArtist = "Artist",
            date = null,
            label = null,
            catalogNumber = null,
            barcode = null,
            composer = null,
            conductor = null,
            ensemble = null,
        )

        assertEquals(1, album.discTotal)
    }
}
