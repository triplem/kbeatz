package org.javafreedom.kbeatz.tagger.codec.flac

import kotlinx.io.bytestring.ByteString
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/**
 * Codec tests that use real .flac fixture files instead of synthetic byte arrays.
 *
 * Fixture files live in src/test/resources/fixtures/ and are committed to source control.
 * Expected field values are documented in that same directory's README.md.
 *
 * Regenerate fixtures:
 *   ./gradlew :kbeatz-tagger:test --tests "*.GenerateFixturesTest"
 */
class FlacFixtureTest {

    private lateinit var withTagsBytes: ByteArray
    private lateinit var withCoverBytes: ByteArray
    private lateinit var corruptedBytes: ByteArray

    @BeforeTest
    fun loadFixtures() {
        withTagsBytes = loadFixture("with-tags.flac")
        withCoverBytes = loadFixture("with-cover.flac")
        corruptedBytes = loadFixture("corrupted.flac")
    }

    // -------------------------------------------------------------------------
    // StreamInfo parsing from a real fixture file
    // -------------------------------------------------------------------------

    @Test
    fun `should parse StreamInfo sample rate from fixture file`() {
        val result = FlacReader().parse(withTagsBytes)

        val si = result.blocks.filterIsInstance<FlacMetadataBlock.StreamInfo>().firstOrNull()
        assertNotNull(si, "Expected StreamInfo block in with-tags.flac")
        assertEquals(FixtureGenerator.SAMPLE_RATE, si.sampleRate,
            "Sample rate should match documented value in fixtures/README.md")
    }

    @Test
    fun `should parse StreamInfo channel count from fixture file`() {
        val result = FlacReader().parse(withTagsBytes)

        val si = result.blocks.filterIsInstance<FlacMetadataBlock.StreamInfo>().first()
        assertEquals(FixtureGenerator.CHANNELS, si.channels,
            "Channel count should match documented value in fixtures/README.md")
    }

    @Test
    fun `should parse StreamInfo bit depth from fixture file`() {
        val result = FlacReader().parse(withTagsBytes)

        val si = result.blocks.filterIsInstance<FlacMetadataBlock.StreamInfo>().first()
        assertEquals(FixtureGenerator.BITS_PER_SAMPLE, si.bitsPerSample,
            "Bits per sample should match documented value in fixtures/README.md")
    }

    @Test
    fun `should parse StreamInfo total samples from fixture file`() {
        val result = FlacReader().parse(withTagsBytes)

        val si = result.blocks.filterIsInstance<FlacMetadataBlock.StreamInfo>().first()
        assertEquals(FixtureGenerator.TOTAL_SAMPLES, si.totalSamples,
            "Total samples should match documented value in fixtures/README.md")
    }

    // -------------------------------------------------------------------------
    // VorbisComment parsing from a real fixture file
    // -------------------------------------------------------------------------

    @Test
    fun `should parse VorbisComment vendor string from fixture file`() {
        val result = FlacReader().parse(withTagsBytes)

        val vc = result.blocks.filterIsInstance<FlacMetadataBlock.VorbisComment>().firstOrNull()
        assertNotNull(vc, "Expected VorbisComment block in with-tags.flac")
        assertEquals(FixtureGenerator.TAG_VENDOR, vc.vendor,
            "Vendor string should match documented value in fixtures/README.md")
    }

    @Test
    fun `should parse TITLE tag from fixture file`() {
        val result = FlacReader().parse(withTagsBytes)

        val vc = result.blocks.filterIsInstance<FlacMetadataBlock.VorbisComment>().first()
        assertEquals(FixtureGenerator.TAG_TITLE, vc.get("TITLE"),
            "TITLE tag should match documented value in fixtures/README.md")
    }

    @Test
    fun `should parse ARTIST tag from fixture file`() {
        val result = FlacReader().parse(withTagsBytes)

        val vc = result.blocks.filterIsInstance<FlacMetadataBlock.VorbisComment>().first()
        assertEquals(FixtureGenerator.TAG_ARTIST, vc.get("ARTIST"),
            "ARTIST tag should match documented value in fixtures/README.md")
    }

    @Test
    fun `should parse ALBUM tag from fixture file`() {
        val result = FlacReader().parse(withTagsBytes)

        val vc = result.blocks.filterIsInstance<FlacMetadataBlock.VorbisComment>().first()
        assertEquals(FixtureGenerator.TAG_ALBUM, vc.get("ALBUM"),
            "ALBUM tag should match documented value in fixtures/README.md")
    }

    @Test
    fun `should parse TRACKNUMBER tag from fixture file`() {
        val result = FlacReader().parse(withTagsBytes)

        val vc = result.blocks.filterIsInstance<FlacMetadataBlock.VorbisComment>().first()
        assertEquals(FixtureGenerator.TAG_TRACKNUMBER, vc.get("TRACKNUMBER"),
            "TRACKNUMBER tag should match documented value in fixtures/README.md")
    }

    @Test
    fun `should parse DATE tag from fixture file`() {
        val result = FlacReader().parse(withTagsBytes)

        val vc = result.blocks.filterIsInstance<FlacMetadataBlock.VorbisComment>().first()
        assertEquals(FixtureGenerator.TAG_DATE, vc.get("DATE"),
            "DATE tag should match documented value in fixtures/README.md")
    }

    @Test
    fun `should parse GENRE tag from fixture file`() {
        val result = FlacReader().parse(withTagsBytes)

        val vc = result.blocks.filterIsInstance<FlacMetadataBlock.VorbisComment>().first()
        assertEquals(FixtureGenerator.TAG_GENRE, vc.get("GENRE"),
            "GENRE tag should match documented value in fixtures/README.md")
    }

    @Test
    fun `should parse all six VorbisComment entries from fixture file`() {
        val result = FlacReader().parse(withTagsBytes)

        val vc = result.blocks.filterIsInstance<FlacMetadataBlock.VorbisComment>().first()
        assertEquals(6, vc.comments.size,
            "Expected 6 comment entries (TITLE, ARTIST, ALBUM, TRACKNUMBER, DATE, GENRE)")
    }

    // -------------------------------------------------------------------------
    // PICTURE block parsing from a real fixture file
    // -------------------------------------------------------------------------

    @Test
    fun `should parse PICTURE block type from fixture file`() {
        val result = FlacReader().parse(withCoverBytes)

        val pic = result.blocks.filterIsInstance<FlacMetadataBlock.Picture>().firstOrNull()
        assertNotNull(pic, "Expected PICTURE block in with-cover.flac")
        assertEquals(FixtureGenerator.PICTURE_TYPE, pic.pictureType,
            "Picture type should be front cover (3) as documented in fixtures/README.md")
    }

    @Test
    fun `should parse PICTURE MIME type from fixture file`() {
        val result = FlacReader().parse(withCoverBytes)

        val pic = result.blocks.filterIsInstance<FlacMetadataBlock.Picture>().first()
        assertEquals(FixtureGenerator.PICTURE_MIME, pic.mimeType,
            "MIME type should match documented value in fixtures/README.md")
    }

    @Test
    fun `should parse PICTURE dimensions from fixture file`() {
        val result = FlacReader().parse(withCoverBytes)

        val pic = result.blocks.filterIsInstance<FlacMetadataBlock.Picture>().first()
        assertEquals(FixtureGenerator.PICTURE_WIDTH, pic.width,
            "Width should match documented value in fixtures/README.md")
        assertEquals(FixtureGenerator.PICTURE_HEIGHT, pic.height,
            "Height should match documented value in fixtures/README.md")
    }

    @Test
    fun `should parse PICTURE byte length from fixture file`() {
        val result = FlacReader().parse(withCoverBytes)

        val pic = result.blocks.filterIsInstance<FlacMetadataBlock.Picture>().first()
        assertEquals(FixtureGenerator.PICTURE_BYTE_LENGTH, pic.data.size,
            "Picture byte length should match documented value in fixtures/README.md")
    }

    @Test
    fun `should parse PICTURE data bytes matching known JPEG content`() {
        val result = FlacReader().parse(withCoverBytes)

        val pic = result.blocks.filterIsInstance<FlacMetadataBlock.Picture>().first()
        assertEquals(ByteString(MINIMAL_JPEG), pic.data,
            "Picture data bytes should match the embedded MINIMAL_JPEG fixture")
    }

    // -------------------------------------------------------------------------
    // Round-trip: fixture file - update tags - re-read
    // -------------------------------------------------------------------------

    @Test
    fun `should preserve StreamInfo after round-trip tag update on fixture file`() {
        val original = FlacReader().parse(withTagsBytes)
        val originalSi = original.blocks.filterIsInstance<FlacMetadataBlock.StreamInfo>().first()

        // Simulate a tag update: write new tags, re-read
        val updatedBlocks = original.blocks.map {
            if (it is FlacMetadataBlock.VorbisComment)
                it.copy(comments = listOf("TITLE=Updated"))
            else it
        }
        val rewritten = FlacWriter(targetPaddingBytes = 0).write(updatedBlocks, original.audioFrames)
        val reread = FlacReader().parse(rewritten)
        val rereadSi = reread.blocks.filterIsInstance<FlacMetadataBlock.StreamInfo>().first()

        assertEquals(originalSi.sampleRate, rereadSi.sampleRate,
            "Sample rate must not change after tag update")
        assertEquals(originalSi.channels, rereadSi.channels,
            "Channel count must not change after tag update")
        assertEquals(originalSi.totalSamples, rereadSi.totalSamples,
            "Total samples must not change after tag update")
        assertEquals(originalSi.bitsPerSample, rereadSi.bitsPerSample,
            "Bit depth must not change after tag update")
    }

    @Test
    fun `should preserve audio frame bytes after round-trip tag update on fixture file`() {
        val original = FlacReader().parse(withTagsBytes)
        val updatedBlocks = original.blocks.map {
            if (it is FlacMetadataBlock.VorbisComment)
                it.copy(comments = listOf("TITLE=Updated"))
            else it
        }
        val rewritten = FlacWriter(targetPaddingBytes = 0).write(updatedBlocks, original.audioFrames)
        val reread = FlacReader().parse(rewritten)

        assertEquals(original.audioFrames.toList(), reread.audioFrames.toList(),
            "Audio frame bytes must be identical after tag update")
    }

    @Test
    fun `should reflect updated tag after round-trip on fixture file`() {
        val original = FlacReader().parse(withTagsBytes)
        val updatedBlocks = original.blocks.map {
            if (it is FlacMetadataBlock.VorbisComment)
                it.copy(comments = listOf("TITLE=Remastered"))
            else it
        }
        val rewritten = FlacWriter(targetPaddingBytes = 0).write(updatedBlocks, original.audioFrames)
        val reread = FlacReader().parse(rewritten)

        val vc = reread.blocks.filterIsInstance<FlacMetadataBlock.VorbisComment>().first()
        assertEquals("Remastered", vc.get("TITLE"),
            "Updated TITLE tag should be present after round-trip")
    }

    // -------------------------------------------------------------------------
    // Error handling: corrupted fixture file
    // -------------------------------------------------------------------------

    @Test
    fun `should throw FlacParseException when reading corrupted fixture file`() {
        val exception = assertFailsWith<FlacParseException>(
            message = "FlacReader should throw FlacParseException on corrupted.flac",
        ) {
            FlacReader().parse(corruptedBytes)
        }
        assertTrue(
            exception.message?.isNotBlank() == true,
            "Exception message should be descriptive, got: ${exception.message}",
        )
    }

    @Test
    fun `should throw FlacParseException when file has no fLaC marker`() {
        val notFlac = byteArrayOf(0x49, 0x44, 0x33.toByte(), 0x04)  // ID3 header, not FLAC

        assertFailsWith<FlacParseException> {
            FlacReader().parse(notFlac)
        }
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private fun loadFixture(name: String): ByteArray {
        val stream = checkNotNull(
            javaClass.classLoader.getResourceAsStream("fixtures/$name"),
        ) { "Fixture file 'fixtures/$name' not found on classpath. " +
            "Run ./gradlew :kbeatz-tagger:test --tests '*.GenerateFixturesTest' to generate it." }
        return stream.use { it.readBytes() }
    }
}
