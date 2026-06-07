package org.javafreedom.kbeatz.tagger.codec.flac

import kotlinx.io.bytestring.ByteString
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/**
 * Tests that the FLAC read-modify-write pipeline preserves all Vorbis Comment fields
 * that are not explicitly modified.
 *
 * Acceptance criteria from issue #95:
 * - ReplayGain fields are preserved when any other tag is modified
 * - Non-standard (unknown) fields are preserved unchanged
 * - All comment fields survive a parse → write round-trip
 * - Duplicate tag entries (e.g. two COMMENT fields) are preserved
 * - Fields not in VorbisCommentFields are stored and returned correctly
 */
class VorbisCommentPreservationTest {

    private val md5Zeros = ByteString(ByteArray(16))

    private val streamInfo = FlacMetadataBlock.StreamInfo(
        minBlockSize = 4096,
        maxBlockSize = 4096,
        minFrameSize = 0,
        maxFrameSize = 0,
        sampleRate = 44100,
        channels = 2,
        bitsPerSample = 16,
        totalSamples = 0L,
        md5 = md5Zeros,
    )

    // -------------------------------------------------------------------------
    // ReplayGain field preservation
    // -------------------------------------------------------------------------

    @Test
    fun `should preserve all four ReplayGain fields when a different tag is modified`() {
        val replayGainComments = listOf(
            "REPLAYGAIN_TRACK_GAIN=-6.35 dB",
            "REPLAYGAIN_TRACK_PEAK=0.987654",
            "REPLAYGAIN_ALBUM_GAIN=-5.89 dB",
            "REPLAYGAIN_ALBUM_PEAK=0.998000",
            "GENRE=Jazz",
        )
        val blocks = listOf<FlacMetadataBlock>(
            streamInfo,
            FlacMetadataBlock.VorbisComment("kbeatz", replayGainComments),
        )
        val file = readFlacFile(blocks)

        val updated = file.updateVorbisComment { editor ->
            editor.set(VorbisCommentFields.GENRE, "Classical")
        }

        val vc = updated.vorbisComment
        assertNotNull(vc)
        assertEquals("-6.35 dB", vc.get("REPLAYGAIN_TRACK_GAIN"))
        assertEquals("0.987654", vc.get("REPLAYGAIN_TRACK_PEAK"))
        assertEquals("-5.89 dB", vc.get("REPLAYGAIN_ALBUM_GAIN"))
        assertEquals("0.998000", vc.get("REPLAYGAIN_ALBUM_PEAK"))
        assertEquals("Classical", vc.get("GENRE"))
    }

    @Test
    fun `should preserve ReplayGain fields through write-read round-trip`() {
        val comments = listOf(
            "REPLAYGAIN_TRACK_GAIN=-6.35 dB",
            "REPLAYGAIN_TRACK_PEAK=0.987654",
            "REPLAYGAIN_ALBUM_GAIN=-5.89 dB",
            "REPLAYGAIN_ALBUM_PEAK=0.998000",
            "TITLE=Test Track",
        )
        val blocks = listOf<FlacMetadataBlock>(
            streamInfo,
            FlacMetadataBlock.VorbisComment("kbeatz", comments),
        )

        val bytes = FlacWriter().write(blocks, ByteArray(0))
        val result = FlacReader().parse(bytes)
        val vc = result.blocks.filterIsInstance<FlacMetadataBlock.VorbisComment>().first()

        assertEquals("-6.35 dB", vc.get("REPLAYGAIN_TRACK_GAIN"))
        assertEquals("0.987654", vc.get("REPLAYGAIN_TRACK_PEAK"))
        assertEquals("-5.89 dB", vc.get("REPLAYGAIN_ALBUM_GAIN"))
        assertEquals("0.998000", vc.get("REPLAYGAIN_ALBUM_PEAK"))
    }

    // -------------------------------------------------------------------------
    // Non-standard / custom field preservation
    // -------------------------------------------------------------------------

    @Test
    fun `should preserve custom non-standard tag fields when a standard field is modified`() {
        val comments = listOf(
            "FOOBAR_CUSTOM=xyz",
            "ACOUSTID_ID=550e8400-e29b-41d4-a716-446655440000",
            "MUSICBRAINZ_TRACKID=b6511e0c-37d9-4c2b-8f83-3c7a5a56a073",
            "FREEDB_DISCID=a50bde0e",
            "TITLE=Original Title",
        )
        val file = readFlacFile(listOf(streamInfo, FlacMetadataBlock.VorbisComment("kbeatz", comments)))

        val updated = file.updateVorbisComment { editor ->
            editor.set(VorbisCommentFields.TITLE, "Updated Title")
        }

        val vc = updated.vorbisComment
        assertNotNull(vc)
        assertEquals("xyz", vc.get("FOOBAR_CUSTOM"))
        assertEquals("550e8400-e29b-41d4-a716-446655440000", vc.get("ACOUSTID_ID"))
        assertEquals("b6511e0c-37d9-4c2b-8f83-3c7a5a56a073", vc.get("MUSICBRAINZ_TRACKID"))
        assertEquals("a50bde0e", vc.get("FREEDB_DISCID"))
        assertEquals("Updated Title", vc.get("TITLE"))
    }

    @Test
    fun `should preserve DISCOGS fields through round-trip when they are not the target of the edit`() {
        val comments = listOf(
            "DISCOGS_RELEASE_ID=12345678",
            "DISCOGS_MASTER_ID=1234567",
            "ALBUM=Kind of Blue",
        )
        val file = readFlacFile(listOf(streamInfo, FlacMetadataBlock.VorbisComment("kbeatz", comments)))

        val updated = file.updateVorbisComment { editor ->
            editor.set(VorbisCommentFields.ALBUM, "Kind of Blue (Remaster)")
        }

        val vc = updated.vorbisComment
        assertNotNull(vc)
        assertEquals("12345678", vc.get("DISCOGS_RELEASE_ID"))
        assertEquals("1234567", vc.get("DISCOGS_MASTER_ID"))
        assertEquals("Kind of Blue (Remaster)", vc.get("ALBUM"))
    }

    // -------------------------------------------------------------------------
    // Round-trip with no modifications
    // -------------------------------------------------------------------------

    @Test
    fun `should preserve every comment field in a no-modification round-trip`() {
        val comments = listOf(
            "TITLE=So What",
            "ARTIST=Miles Davis",
            "ALBUM=Kind of Blue",
            "TRACKNUMBER=1",
            "REPLAYGAIN_TRACK_GAIN=-7.00 dB",
            "REPLAYGAIN_ALBUM_GAIN=-6.50 dB",
            "FOOBAR_CUSTOM=keepme",
            "ACOUSTID_ID=some-id",
        )
        val blocks = listOf<FlacMetadataBlock>(streamInfo, FlacMetadataBlock.VorbisComment("kbeatz", comments))

        val bytes = FlacWriter().write(blocks, ByteArray(0))
        val result = FlacReader().parse(bytes)
        val vc = result.blocks.filterIsInstance<FlacMetadataBlock.VorbisComment>().first()

        assertEquals(comments.size, vc.comments.size)
        comments.forEach { original ->
            assertTrue(vc.comments.contains(original), "Expected comment '$original' to be present")
        }
    }

    // -------------------------------------------------------------------------
    // Duplicate tag entries
    // -------------------------------------------------------------------------

    @Test
    fun `should preserve both entries when a tag field appears twice`() {
        val comments = listOf(
            "COMMENT=Ripped from vinyl",
            "COMMENT=Remastered 2024",
            "TITLE=Test",
        )
        val file = readFlacFile(listOf(streamInfo, FlacMetadataBlock.VorbisComment("kbeatz", comments)))

        val updated = file.updateVorbisComment { editor ->
            editor.set(VorbisCommentFields.TITLE, "Updated Test")
        }

        val vc = updated.vorbisComment
        assertNotNull(vc)
        val commentValues = vc.getAll("COMMENT")
        assertEquals(2, commentValues.size)
        assertTrue(commentValues.contains("Ripped from vinyl"))
        assertTrue(commentValues.contains("Remastered 2024"))
    }

    @Test
    fun `should preserve duplicate tag entries through write-read round-trip`() {
        val comments = listOf(
            "ARTIST=Miles Davis",
            "ARTIST=John Coltrane",
            "TITLE=So What",
        )
        val blocks = listOf<FlacMetadataBlock>(streamInfo, FlacMetadataBlock.VorbisComment("kbeatz", comments))

        val bytes = FlacWriter().write(blocks, ByteArray(0))
        val result = FlacReader().parse(bytes)
        val vc = result.blocks.filterIsInstance<FlacMetadataBlock.VorbisComment>().first()

        val artists = vc.getAll("ARTIST")
        assertEquals(2, artists.size)
        assertTrue(artists.contains("Miles Davis"))
        assertTrue(artists.contains("John Coltrane"))
    }

    // -------------------------------------------------------------------------
    // VorbisCommentEditor preserves unknown fields
    // -------------------------------------------------------------------------

    @Test
    fun `VorbisCommentEditor set should not touch unrelated comment entries`() {
        val editor = VorbisCommentEditor(
            "vendor",
            mutableListOf(
                "REPLAYGAIN_TRACK_GAIN=-6.35 dB",
                "REPLAYGAIN_TRACK_PEAK=0.987654",
                "FOOBAR_CUSTOM=xyz",
                "TITLE=Original",
            ),
        )
        editor.set("TITLE", "Replaced")
        val result = editor.build()

        // Only TITLE changed; everything else must be intact
        assertEquals("Replaced", result.get("TITLE"))
        assertEquals("-6.35 dB", result.get("REPLAYGAIN_TRACK_GAIN"))
        assertEquals("0.987654", result.get("REPLAYGAIN_TRACK_PEAK"))
        assertEquals("xyz", result.get("FOOBAR_CUSTOM"))
        assertEquals(4, result.comments.size)
    }

    @Test
    fun `VorbisCommentEditor remove should not affect other fields`() {
        val editor = VorbisCommentEditor(
            "vendor",
            mutableListOf(
                "REPLAYGAIN_TRACK_GAIN=-6.35 dB",
                "GENRE=Jazz",
                "FOOBAR_CUSTOM=xyz",
            ),
        )
        editor.remove("GENRE")
        val result = editor.build()

        assertEquals(2, result.comments.size)
        assertEquals("-6.35 dB", result.get("REPLAYGAIN_TRACK_GAIN"))
        assertEquals("xyz", result.get("FOOBAR_CUSTOM"))
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private fun readFlacFile(blocks: List<FlacMetadataBlock>): FlacFile {
        val bytes = FlacWriter().write(blocks, ByteArray(0))
        val tmpFile = java.io.File(System.getProperty("java.io.tmpdir"), "test-${System.nanoTime()}.flac")
        tmpFile.writeBytes(bytes)
        tmpFile.deleteOnExit()
        return FlacFile.read(kotlinx.io.files.Path(tmpFile.absolutePath))
    }
}
