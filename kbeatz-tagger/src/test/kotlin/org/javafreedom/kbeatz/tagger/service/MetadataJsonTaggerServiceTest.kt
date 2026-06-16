package org.javafreedom.kbeatz.tagger.service

import io.mockk.mockk
import kotlin.time.Instant
import kotlinx.io.bytestring.ByteString
import kotlinx.io.files.Path
import org.javafreedom.kbeatz.common.FlacTrackCountMismatchException
import org.javafreedom.kbeatz.common.metadata.KbeatzMetadata
import org.javafreedom.kbeatz.sources.MetadataSource
import org.javafreedom.kbeatz.tagger.codec.flac.FlacMetadataBlock
import org.javafreedom.kbeatz.tagger.codec.flac.FlacReader
import org.javafreedom.kbeatz.tagger.codec.flac.FlacWriter
import org.javafreedom.kbeatz.tagger.codec.flac.VorbisCommentFields
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Files
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertNull

/**
 * Tests for [DefaultTaggerService.tag] - the KbeatzMetadata-based tagging path.
 *
 * These tests cover:
 *   - Single-disc album: DISCNUMBER=1, DISCTOTAL=1, TRACKNUMBER per sorted position
 *   - Multi-disc album: per-disc subdirectory matching (sorted alphabetically)
 *   - Image embedding from localPath
 *   - Missing image skipped silently
 *   - Track count mismatch returns TrackCountMismatch
 *   - All Vorbis Comment fields written correctly
 */
class MetadataJsonTaggerServiceTest {

    private val metadataSource = mockk<MetadataSource>()

    private val md5Zeros = ByteString(ByteArray(16))
    private val streamInfo = FlacMetadataBlock.StreamInfo(
        minBlockSize = 4096, maxBlockSize = 4096,
        minFrameSize = 0, maxFrameSize = 0,
        sampleRate = 44100, channels = 2, bitsPerSample = 16,
        totalSamples = 0L, md5 = md5Zeros,
    )

    private fun minimalFlacBytes(): ByteArray = FlacWriter().write(
        listOf(streamInfo, FlacMetadataBlock.VorbisComment("test", emptyList())),
        ByteArray(0),
    )

    private fun singleDiscMetadata(trackCount: Int = 3): KbeatzMetadata = KbeatzMetadata(
        source = "discogs",
        sourceId = "12345",
        fetchedAt = Instant.parse("2024-01-01T00:00:00Z"),
        album = KbeatzMetadata.Album(
            title = "Kind of Blue",
            albumArtist = "Miles Davis",
            date = "1959",
            genres = listOf("Jazz"),
            label = "Columbia",
            catalogNumber = "CL 1355",
            barcode = "074646154328",
            composer = null,
            conductor = null,
            ensemble = null,
            discTotal = 1,
        ),
        tracks = (1..trackCount).map { n ->
            KbeatzMetadata.Track(
                discNumber = 1,
                trackNumber = n,
                trackTotal = trackCount,
                title = "Track $n",
                artist = "Miles Davis",
                duration = null,
                discSubtitle = null,
                originalPosition = n.toString(),
            )
        },
        images = emptyList(),
    )

    private fun service() = DefaultTaggerService(metadataSource = metadataSource)

    // -------------------------------------------------------------------------
    // Single-disc album
    // -------------------------------------------------------------------------

    @Test
    fun `should write DISCNUMBER=1 and DISCTOTAL=1 for single-disc album`(@TempDir tempDir: java.nio.file.Path) {
        repeat(3) { i -> Files.write(tempDir.resolve("0${i + 1}-track.flac"), minimalFlacBytes()) }

        val result = service().tag(Path(tempDir.toString()), singleDiscMetadata(3))

        assertIs<TagResult.Tagged>(result)
        assertEquals(3, result.filesWritten)

        val tags = readVorbisComment(tempDir.resolve("01-track.flac").toAbsolutePath().toString())
        assertEquals("1", tags.get(VorbisCommentFields.DISCNUMBER))
        assertEquals("1", tags.get(VorbisCommentFields.DISCTOTAL))
    }

    @Test
    fun `should write TRACKNUMBER 1 2 3 in sorted file order for single-disc album`(
        @TempDir tempDir: java.nio.file.Path,
    ) {
        repeat(3) { i -> Files.write(tempDir.resolve("0${i + 1}-track.flac"), minimalFlacBytes()) }

        service().tag(Path(tempDir.toString()), singleDiscMetadata(3))

        assertEquals("1", readVorbisComment(tempDir.resolve("01-track.flac").toString()).get(VorbisCommentFields.TRACKNUMBER))
        assertEquals("2", readVorbisComment(tempDir.resolve("02-track.flac").toString()).get(VorbisCommentFields.TRACKNUMBER))
        assertEquals("3", readVorbisComment(tempDir.resolve("03-track.flac").toString()).get(VorbisCommentFields.TRACKNUMBER))
    }

    @Test
    fun `should write TRACKTOTAL=3 for single-disc album with 3 tracks`(@TempDir tempDir: java.nio.file.Path) {
        repeat(3) { i -> Files.write(tempDir.resolve("0${i + 1}-track.flac"), minimalFlacBytes()) }

        service().tag(Path(tempDir.toString()), singleDiscMetadata(3))

        val tags = readVorbisComment(tempDir.resolve("01-track.flac").toString())
        assertEquals("3", tags.get(VorbisCommentFields.TRACKTOTAL))
    }

    @Test
    fun `should write album-level Vorbis Comment fields from metadata`(@TempDir tempDir: java.nio.file.Path) {
        Files.write(tempDir.resolve("01-track.flac"), minimalFlacBytes())

        service().tag(Path(tempDir.toString()), singleDiscMetadata(1))

        val tags = readVorbisComment(tempDir.resolve("01-track.flac").toString())
        assertEquals("Kind of Blue", tags.get(VorbisCommentFields.ALBUM))
        assertEquals("Miles Davis", tags.get(VorbisCommentFields.ALBUMARTIST))
        assertEquals("1959", tags.get(VorbisCommentFields.DATE))
        assertEquals("Jazz", tags.get(VorbisCommentFields.GENRE))
        assertEquals("Columbia", tags.get(VorbisCommentFields.LABEL))
        assertEquals("CL 1355", tags.get(VorbisCommentFields.CATALOGNUMBER))
        assertEquals("074646154328", tags.get(VorbisCommentFields.BARCODE))
        assertEquals("12345", tags.get(VorbisCommentFields.DISCOGS_ID))
    }

    @Test
    fun `should write track-level Vorbis Comment fields from metadata`(@TempDir tempDir: java.nio.file.Path) {
        Files.write(tempDir.resolve("01-track.flac"), minimalFlacBytes())

        service().tag(Path(tempDir.toString()), singleDiscMetadata(1))

        val tags = readVorbisComment(tempDir.resolve("01-track.flac").toString())
        assertEquals("Track 1", tags.get(VorbisCommentFields.TITLE))
        assertEquals("Miles Davis", tags.get(VorbisCommentFields.ARTIST))
    }

    @Test
    fun `should write classical fields when composer and conductor are present`(
        @TempDir tempDir: java.nio.file.Path,
    ) {
        Files.write(tempDir.resolve("01-track.flac"), minimalFlacBytes())
        val metadata = singleDiscMetadata(1).copy(
            album = singleDiscMetadata(1).album.copy(
                composer = "Ludwig van Beethoven",
                conductor = "Herbert von Karajan",
                ensemble = "Berlin Philharmonic",
            ),
        )

        service().tag(Path(tempDir.toString()), metadata)

        val tags = readVorbisComment(tempDir.resolve("01-track.flac").toString())
        assertEquals("Ludwig van Beethoven", tags.get(VorbisCommentFields.COMPOSER))
        assertEquals("Herbert von Karajan", tags.get(VorbisCommentFields.CONDUCTOR))
        assertEquals("Berlin Philharmonic", tags.get(VorbisCommentFields.ENSEMBLE))
    }

    @Test
    fun `should write DISCSUBTITLE when track has discSubtitle`(@TempDir tempDir: java.nio.file.Path) {
        Files.write(tempDir.resolve("01-track.flac"), minimalFlacBytes())
        val metadata = singleDiscMetadata(1).copy(
            tracks = listOf(
                KbeatzMetadata.Track(
                    discNumber = 1,
                    trackNumber = 1,
                    trackTotal = 1,
                    title = "Track 1",
                    artist = "Miles Davis",
                    duration = null,
                    discSubtitle = "Disc One: The Beginning",
                    originalPosition = "1",
                ),
            ),
        )

        service().tag(Path(tempDir.toString()), metadata)

        val tags = readVorbisComment(tempDir.resolve("01-track.flac").toString())
        assertEquals("Disc One: The Beginning", tags.get(VorbisCommentFields.DISCSUBTITLE))
    }

    @Test
    fun `should fall back to albumArtist for ARTIST tag when track artist is null`(
        @TempDir tempDir: java.nio.file.Path,
    ) {
        Files.write(tempDir.resolve("01-track.flac"), minimalFlacBytes())
        val metadata = singleDiscMetadata(1).copy(
            tracks = listOf(
                KbeatzMetadata.Track(
                    discNumber = 1,
                    trackNumber = 1,
                    trackTotal = 1,
                    title = "Track 1",
                    artist = null,
                    duration = null,
                    discSubtitle = null,
                    originalPosition = "1",
                ),
            ),
        )

        service().tag(Path(tempDir.toString()), metadata)

        val tags = readVorbisComment(tempDir.resolve("01-track.flac").toString())
        assertEquals("Miles Davis", tags.get(VorbisCommentFields.ARTIST))
    }

    @Test
    fun `should not write DISCOGS_ID when source is not discogs`(@TempDir tempDir: java.nio.file.Path) {
        Files.write(tempDir.resolve("01-track.flac"), minimalFlacBytes())
        val metadata = singleDiscMetadata(1).copy(source = "musicbrainz")

        service().tag(Path(tempDir.toString()), metadata)

        val tags = readVorbisComment(tempDir.resolve("01-track.flac").toString())
        assertNull(tags.get(VorbisCommentFields.DISCOGS_ID))
    }

    // -------------------------------------------------------------------------
    // Multi-disc album
    // -------------------------------------------------------------------------

    @Test
    fun `should write per-disc DISCNUMBER and TRACKNUMBER for multi-disc album`(
        @TempDir tempDir: java.nio.file.Path,
    ) {
        val cd1 = Files.createDirectory(tempDir.resolve("cd1"))
        val cd2 = Files.createDirectory(tempDir.resolve("cd2"))
        repeat(2) { i -> Files.write(cd1.resolve("0${i + 1}-track.flac"), minimalFlacBytes()) }
        repeat(3) { i -> Files.write(cd2.resolve("0${i + 1}-track.flac"), minimalFlacBytes()) }

        val metadata = multiDiscMetadata(disc1Tracks = 2, disc2Tracks = 3)
        val result = service().tag(Path(tempDir.toString()), metadata)

        assertIs<TagResult.Tagged>(result)
        assertEquals(5, result.filesWritten)

        val cd1Tags1 = readVorbisComment(cd1.resolve("01-track.flac").toString())
        assertEquals("1", cd1Tags1.get(VorbisCommentFields.DISCNUMBER))
        assertEquals("2", cd1Tags1.get(VorbisCommentFields.DISCTOTAL))
        assertEquals("1", cd1Tags1.get(VorbisCommentFields.TRACKNUMBER))
        assertEquals("2", cd1Tags1.get(VorbisCommentFields.TRACKTOTAL))

        val cd1Tags2 = readVorbisComment(cd1.resolve("02-track.flac").toString())
        assertEquals("2", cd1Tags2.get(VorbisCommentFields.TRACKNUMBER))

        val cd2Tags1 = readVorbisComment(cd2.resolve("01-track.flac").toString())
        assertEquals("2", cd2Tags1.get(VorbisCommentFields.DISCNUMBER))
        assertEquals("2", cd2Tags1.get(VorbisCommentFields.DISCTOTAL))
        assertEquals("1", cd2Tags1.get(VorbisCommentFields.TRACKNUMBER))
        assertEquals("3", cd2Tags1.get(VorbisCommentFields.TRACKTOTAL))

        val cd2Tags3 = readVorbisComment(cd2.resolve("03-track.flac").toString())
        assertEquals("3", cd2Tags3.get(VorbisCommentFields.TRACKNUMBER))
    }

    @Test
    fun `should sort subdirectories alphabetically for disc assignment`(@TempDir tempDir: java.nio.file.Path) {
        // Deliberately create in non-alphabetical order to verify sort
        val discB = Files.createDirectory(tempDir.resolve("disc-b"))
        val discA = Files.createDirectory(tempDir.resolve("disc-a"))
        Files.write(discA.resolve("01-track.flac"), minimalFlacBytes())
        Files.write(discB.resolve("01-track.flac"), minimalFlacBytes())

        val metadata = multiDiscMetadata(disc1Tracks = 1, disc2Tracks = 1)
        service().tag(Path(tempDir.toString()), metadata)

        // disc-a should be disc 1, disc-b should be disc 2
        val discATags = readVorbisComment(discA.resolve("01-track.flac").toString())
        assertEquals("1", discATags.get(VorbisCommentFields.DISCNUMBER))
        val discBTags = readVorbisComment(discB.resolve("01-track.flac").toString())
        assertEquals("2", discBTags.get(VorbisCommentFields.DISCNUMBER))
    }

    // -------------------------------------------------------------------------
    // Track count mismatch
    // -------------------------------------------------------------------------

    @Test
    fun `should return TrackCountMismatch when FLAC count does not match expected track count`(
        @TempDir tempDir: java.nio.file.Path,
    ) {
        repeat(3) { i -> Files.write(tempDir.resolve("0${i + 1}-track.flac"), minimalFlacBytes()) }
        // metadata says 4 tracks but directory has 3 FLAC files
        val metadata = singleDiscMetadata(4)

        val result = service().tag(Path(tempDir.toString()), metadata)

        assertIs<TagResult.TrackCountMismatch>(result)
        assertEquals(1, result.disc)
        assertEquals(3, result.files)
        assertEquals(4, result.expected)
    }

    @Test
    fun `should write no tags when track count mismatch occurs`(@TempDir tempDir: java.nio.file.Path) {
        repeat(2) { i -> Files.write(tempDir.resolve("0${i + 1}-track.flac"), minimalFlacBytes()) }
        val metadataWith3Tracks = singleDiscMetadata(3)

        service().tag(Path(tempDir.toString()), metadataWith3Tracks)

        // Tags should remain empty - no write occurred
        val tags = readVorbisComment(tempDir.resolve("01-track.flac").toString())
        assertNull(tags.get(VorbisCommentFields.ALBUM))
    }

    // -------------------------------------------------------------------------
    // Image embedding
    // -------------------------------------------------------------------------

    @Test
    fun `should embed image in PICTURE block when localPath file exists`(@TempDir tempDir: java.nio.file.Path) {
        Files.write(tempDir.resolve("01-track.flac"), minimalFlacBytes())
        val imageBytes = byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte(), 0xD9.toByte())
        Files.write(tempDir.resolve("folder.jpg"), imageBytes)

        val metadata = singleDiscMetadata(1).copy(
            images = listOf(
                KbeatzMetadata.Image(
                    pictureType = FlacMetadataBlock.Picture.TYPE_FRONT_COVER,
                    description = "Front cover",
                    mimeType = "image/jpeg",
                    sourceUri = "https://example.com/cover.jpg",
                    localPath = "folder.jpg",
                ),
            ),
        )

        service().tag(Path(tempDir.toString()), metadata)

        val blocks = FlacReader().parse(Files.readAllBytes(tempDir.resolve("01-track.flac")))
            .blocks
        val picture = blocks.filterIsInstance<FlacMetadataBlock.Picture>().firstOrNull()
        assertNotNull(picture)
        assertEquals(FlacMetadataBlock.Picture.TYPE_FRONT_COVER, picture.pictureType)
        assertEquals("image/jpeg", picture.mimeType)
        assertEquals(ByteString(imageBytes), picture.data)
    }

    @Test
    fun `should embed image in ALL FLAC files in the album`(@TempDir tempDir: java.nio.file.Path) {
        repeat(3) { i -> Files.write(tempDir.resolve("0${i + 1}-track.flac"), minimalFlacBytes()) }
        val imageBytes = byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte(), 0xD9.toByte())
        Files.write(tempDir.resolve("folder.jpg"), imageBytes)

        val metadata = singleDiscMetadata(3).copy(
            images = listOf(
                KbeatzMetadata.Image(
                    pictureType = FlacMetadataBlock.Picture.TYPE_FRONT_COVER,
                    description = null,
                    mimeType = "image/jpeg",
                    sourceUri = "https://example.com/cover.jpg",
                    localPath = "folder.jpg",
                ),
            ),
        )

        service().tag(Path(tempDir.toString()), metadata)

        for (n in 1..3) {
            val flacPath = tempDir.resolve("0$n-track.flac")
            val pic = FlacReader().parse(Files.readAllBytes(flacPath))
                .blocks.filterIsInstance<FlacMetadataBlock.Picture>().firstOrNull()
            assertNotNull(pic, "Track $n should have a PICTURE block")
            assertEquals(FlacMetadataBlock.Picture.TYPE_FRONT_COVER, pic.pictureType)
        }
    }

    @Test
    fun `should skip missing image file silently and succeed`(@TempDir tempDir: java.nio.file.Path) {
        Files.write(tempDir.resolve("01-track.flac"), minimalFlacBytes())
        // back.jpg is NOT written to disk

        val metadata = singleDiscMetadata(1).copy(
            images = listOf(
                KbeatzMetadata.Image(
                    pictureType = FlacMetadataBlock.Picture.TYPE_BACK_COVER,
                    description = null,
                    mimeType = "image/jpeg",
                    sourceUri = "https://example.com/back.jpg",
                    localPath = "back.jpg",
                ),
            ),
        )

        val result = service().tag(Path(tempDir.toString()), metadata)

        assertIs<TagResult.Tagged>(result)
        val blocks = FlacReader().parse(Files.readAllBytes(tempDir.resolve("01-track.flac"))).blocks
        val picture = blocks.filterIsInstance<FlacMetadataBlock.Picture>().firstOrNull()
        assertNull(picture, "No PICTURE block should be written for a missing image file")
    }

    @Test
    fun `should infer MIME type from file extension when mimeType is null`(@TempDir tempDir: java.nio.file.Path) {
        Files.write(tempDir.resolve("01-track.flac"), minimalFlacBytes())
        val pngBytes = byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47)
        Files.write(tempDir.resolve("cover.png"), pngBytes)

        val metadata = singleDiscMetadata(1).copy(
            images = listOf(
                KbeatzMetadata.Image(
                    pictureType = FlacMetadataBlock.Picture.TYPE_FRONT_COVER,
                    description = null,
                    mimeType = null,
                    sourceUri = "https://example.com/cover.png",
                    localPath = "cover.png",
                ),
            ),
        )

        service().tag(Path(tempDir.toString()), metadata)

        val pic = FlacReader().parse(Files.readAllBytes(tempDir.resolve("01-track.flac")))
            .blocks.filterIsInstance<FlacMetadataBlock.Picture>().firstOrNull()
        assertNotNull(pic)
        assertEquals("image/png", pic.mimeType)
    }

    // -------------------------------------------------------------------------
    // Security: path traversal rejection
    // -------------------------------------------------------------------------

    @Test
    fun `should reject localPath with directory traversal and not embed image`(@TempDir tempDir: java.nio.file.Path) {
        Files.write(tempDir.resolve("01-track.flac"), minimalFlacBytes())
        // Create a file outside the album directory that traversal would reach
        val secretFile = Files.createTempFile("secret", ".jpg")
        secretFile.toFile().writeBytes(byteArrayOf(0xFF.toByte(), 0xD8.toByte()))
        val traversalPath = "../../${secretFile.fileName}"

        val metadata = singleDiscMetadata(1).copy(
            images = listOf(
                KbeatzMetadata.Image(
                    pictureType = FlacMetadataBlock.Picture.TYPE_FRONT_COVER,
                    description = null,
                    mimeType = "image/jpeg",
                    sourceUri = "https://example.com/cover.jpg",
                    localPath = traversalPath,
                ),
            ),
        )

        val result = service().tag(Path(tempDir.toString()), metadata)

        // Processing should succeed (traversal path is silently skipped)
        assertIs<TagResult.Tagged>(result)
        val blocks = FlacReader().parse(Files.readAllBytes(tempDir.resolve("01-track.flac"))).blocks
        val picture = blocks.filterIsInstance<FlacMetadataBlock.Picture>().firstOrNull()
        assertNull(picture, "Traversal localPath must not produce a PICTURE block")
        secretFile.toFile().delete()
    }

    @Test
    fun `should reject localPath starting with slash`(@TempDir tempDir: java.nio.file.Path) {
        Files.write(tempDir.resolve("01-track.flac"), minimalFlacBytes())

        val metadata = singleDiscMetadata(1).copy(
            images = listOf(
                KbeatzMetadata.Image(
                    pictureType = FlacMetadataBlock.Picture.TYPE_FRONT_COVER,
                    description = null,
                    mimeType = "image/jpeg",
                    sourceUri = "https://example.com/cover.jpg",
                    localPath = "/etc/passwd",
                ),
            ),
        )

        val result = service().tag(Path(tempDir.toString()), metadata)

        assertIs<TagResult.Tagged>(result)
        val pic = FlacReader().parse(Files.readAllBytes(tempDir.resolve("01-track.flac")))
            .blocks.filterIsInstance<FlacMetadataBlock.Picture>().firstOrNull()
        assertNull(pic, "Absolute localPath must not produce a PICTURE block")
    }

    // -------------------------------------------------------------------------
    // Directory layout edge cases
    // -------------------------------------------------------------------------

    @Test
    fun `should not treat dot-kbeatz directory as a disc subdirectory for multi-disc album`(
        @TempDir tempDir: java.nio.file.Path,
    ) {
        // .kbeatz must not be counted when listing subdirectories for disc assignment.
        // Disc assignment should only see cd1/ and cd2/, not .kbeatz/
        val kbeatzDir = Files.createDirectory(tempDir.resolve(".kbeatz"))
        val cd1 = Files.createDirectory(tempDir.resolve("cd1"))
        val cd2 = Files.createDirectory(tempDir.resolve("cd2"))
        // Any FLACs inside .kbeatz must not be processed
        Files.write(kbeatzDir.resolve("spurious.flac"), minimalFlacBytes())
        Files.write(cd1.resolve("01-track.flac"), minimalFlacBytes())
        Files.write(cd2.resolve("01-track.flac"), minimalFlacBytes())

        val metadata = KbeatzMetadata(
            source = "discogs",
            sourceId = "999",
            fetchedAt = Instant.parse("2024-01-01T00:00:00Z"),
            album = KbeatzMetadata.Album(
                title = "Test", albumArtist = "Artist", date = null,
                genres = emptyList(), label = null, catalogNumber = null, barcode = null,
                composer = null, conductor = null, ensemble = null, discTotal = 2,
            ),
            tracks = listOf(
                KbeatzMetadata.Track(
                    discNumber = 1, trackNumber = 1, trackTotal = 1,
                    title = "Track 1", artist = null, duration = null,
                    discSubtitle = null, originalPosition = "1-1",
                ),
                KbeatzMetadata.Track(
                    discNumber = 2, trackNumber = 1, trackTotal = 1,
                    title = "Track 1 D2", artist = null, duration = null,
                    discSubtitle = null, originalPosition = "2-1",
                ),
            ),
            images = emptyList(),
        )

        val result = service().tag(Path(tempDir.toString()), metadata)

        // .kbeatz excluded - exactly 2 discs matched to cd1/ and cd2/, 1 file each
        assertIs<TagResult.Tagged>(result)
        assertEquals(2, result.filesWritten)
        // Verify DISCNUMBER was written correctly, confirming .kbeatz was skipped in sort order
        val cd1Tags = readVorbisComment(cd1.resolve("01-track.flac").toString())
        assertEquals("1", cd1Tags.get(VorbisCommentFields.DISCNUMBER))
        val cd2Tags = readVorbisComment(cd2.resolve("01-track.flac").toString())
        assertEquals("2", cd2Tags.get(VorbisCommentFields.DISCNUMBER))
    }

    // -------------------------------------------------------------------------
    // Error handling
    // -------------------------------------------------------------------------

    @Test
    fun `should return Failed when FLAC file is corrupt`(@TempDir tempDir: java.nio.file.Path) {
        Files.write(tempDir.resolve("01-track.flac"), ByteArray(0)) // corrupt

        val result = service().tag(Path(tempDir.toString()), singleDiscMetadata(1))

        assertIs<TagResult.Failed>(result)
    }

    @Test
    fun `should return Tagged with zero files when album directory is empty`(@TempDir tempDir: java.nio.file.Path) {
        val metadata = singleDiscMetadata(0).copy(tracks = emptyList())

        val result = service().tag(Path(tempDir.toString()), metadata)

        assertIs<TagResult.Tagged>(result)
        assertEquals(0, result.filesWritten)
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private fun readVorbisComment(path: String): FlacMetadataBlock.VorbisComment {
        val bytes = java.io.File(path).readBytes()
        return FlacReader().parse(bytes)
            .blocks.filterIsInstance<FlacMetadataBlock.VorbisComment>().first()
    }

    private fun multiDiscMetadata(disc1Tracks: Int, disc2Tracks: Int): KbeatzMetadata {
        val disc1 = (1..disc1Tracks).map { n ->
            KbeatzMetadata.Track(
                discNumber = 1,
                trackNumber = n,
                trackTotal = disc1Tracks,
                title = "Disc 1 Track $n",
                artist = "Miles Davis",
                duration = null,
                discSubtitle = null,
                originalPosition = "1-$n",
            )
        }
        val disc2 = (1..disc2Tracks).map { n ->
            KbeatzMetadata.Track(
                discNumber = 2,
                trackNumber = n,
                trackTotal = disc2Tracks,
                title = "Disc 2 Track $n",
                artist = "Miles Davis",
                duration = null,
                discSubtitle = null,
                originalPosition = "2-$n",
            )
        }
        return KbeatzMetadata(
            source = "discogs",
            sourceId = "99999",
            fetchedAt = Instant.parse("2024-01-01T00:00:00Z"),
            album = KbeatzMetadata.Album(
                title = "Double Album",
                albumArtist = "Miles Davis",
                date = "1964",
                genres = listOf("Jazz"),
                label = "Columbia",
                catalogNumber = null,
                barcode = null,
                composer = null,
                conductor = null,
                ensemble = null,
                discTotal = 2,
            ),
            tracks = disc1 + disc2,
            images = emptyList(),
        )
    }
}
