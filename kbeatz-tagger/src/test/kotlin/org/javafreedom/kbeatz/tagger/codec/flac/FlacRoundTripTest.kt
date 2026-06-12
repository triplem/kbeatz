package org.javafreedom.kbeatz.tagger.codec.flac

import kotlinx.io.bytestring.ByteString
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class FlacRoundTripTest {

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

    private val vorbisComment = FlacMetadataBlock.VorbisComment(
        vendor = "test",
        comments = listOf("TITLE=Hello"),
    )

    // -------------------------------------------------------------------------
    // Round-trip: write then read back
    // -------------------------------------------------------------------------

    @Test
    fun `should round-trip StreamInfo through write then parse`() {
        val blocks = listOf<FlacMetadataBlock>(streamInfo, vorbisComment)
        val bytes = FlacWriter().write(blocks, ByteArray(0))
        val result = FlacReader().parse(bytes)

        val si = result.blocks.filterIsInstance<FlacMetadataBlock.StreamInfo>().first()
        assertEquals(streamInfo.minBlockSize, si.minBlockSize)
        assertEquals(streamInfo.maxBlockSize, si.maxBlockSize)
        assertEquals(streamInfo.sampleRate, si.sampleRate)
        assertEquals(streamInfo.channels, si.channels)
        assertEquals(streamInfo.bitsPerSample, si.bitsPerSample)
        assertEquals(streamInfo.totalSamples, si.totalSamples)
        assertEquals(streamInfo.md5, si.md5)
    }

    @Test
    fun `should round-trip VorbisComment vendor and comments through write then parse`() {
        val blocks = listOf<FlacMetadataBlock>(streamInfo, vorbisComment)
        val bytes = FlacWriter().write(blocks, ByteArray(0))
        val result = FlacReader().parse(bytes)

        val vc = result.blocks.filterIsInstance<FlacMetadataBlock.VorbisComment>().firstOrNull()
        assertNotNull(vc)
        assertEquals("test", vc.vendor)
        assertEquals(listOf("TITLE=Hello"), vc.comments)
    }

    @Test
    fun `should preserve empty audio frames through round-trip`() {
        val blocks = listOf<FlacMetadataBlock>(streamInfo, vorbisComment)
        val bytes = FlacWriter().write(blocks, ByteArray(0))
        val result = FlacReader().parse(bytes)

        assertEquals(0, result.audioFrames.size)
    }

    @Test
    fun `should preserve non-empty audio frames through round-trip`() {
        val audio = byteArrayOf(0x01, 0x02, 0x03, 0xFF.toByte())
        val blocks = listOf<FlacMetadataBlock>(streamInfo, vorbisComment)
        val bytes = FlacWriter().write(blocks, audio)
        val result = FlacReader().parse(bytes)

        assertEquals(audio.toList(), result.audioFrames.toList())
    }

    @Test
    fun `should throw FlacParseException when data does not start with fLaC marker`() {
        assertFailsWith<FlacParseException> {
            FlacReader().parse(byteArrayOf(0x00, 0x01, 0x02, 0x03))
        }
    }

    @Test
    fun `should throw FlacParseException when file is truncated mid-block`() {
        // A valid FLAC file whose StreamInfo block header declares a length the bytes
        // do not satisfy: we keep the 'fLaC' marker and the 4-byte block header but cut
        // the file off inside the StreamInfo payload. The reader must surface this as a
        // typed FlacParseException, not an unchecked EOFException.
        val full = FlacWriter().write(listOf<FlacMetadataBlock>(streamInfo, vorbisComment), ByteArray(0))

        // fLaC marker (4) + first block header (4) = 8 bytes; keep header + 2 payload bytes
        // so the declared StreamInfo length cannot be read in full.
        val truncated = full.copyOfRange(0, 10)

        val ex = assertFailsWith<FlacParseException> {
            FlacReader().parse(truncated)
        }
        assertTrue(
            ex.message?.contains("Truncated or malformed") == true,
            "Expected a truncation message but was: ${ex.message}",
        )
    }

    @Test
    fun `should throw FlacParseException when block length exceeds remaining bytes`() {
        // Marker + a block header that claims a 4096-byte payload, followed by only a few bytes.
        // The reader attempts to read 4096 bytes, hits end-of-input, and wraps the failure.
        val marker = byteArrayOf(0x66, 0x4C, 0x61, 0x43) // "fLaC"
        @Suppress("MagicNumber") // last-block StreamInfo header declaring 4096-byte payload
        val header = byteArrayOf(0x80.toByte(), 0x00, 0x10, 0x00) // last=true, type=0, length=4096
        val truncated = marker + header + byteArrayOf(0x01, 0x02, 0x03)

        assertFailsWith<FlacParseException> {
            FlacReader().parse(truncated)
        }
    }

    // -------------------------------------------------------------------------
    // FlacFile.withVorbisComment
    // -------------------------------------------------------------------------

    @Test
    fun `withVorbisComment should replace existing VorbisComment block`() {
        val original = FlacMetadataBlock.VorbisComment("orig", listOf("TITLE=Old"))
        val replacement = FlacMetadataBlock.VorbisComment("new-vendor", listOf("TITLE=New"))

        val blocks = listOf<FlacMetadataBlock>(streamInfo, original)
        val bytes = FlacWriter().write(blocks, ByteArray(0))
        val result = FlacReader().parse(bytes)
        val file = FlacFile.read(createTempFlacFile(blocks))

        val updated = file.withVorbisComment(replacement)
        val vc = updated.vorbisComment
        assertNotNull(vc)
        assertEquals("new-vendor", vc.vendor)
        assertEquals(listOf("TITLE=New"), vc.comments)
        // Original block must no longer be present
        assertEquals(1, updated.metadataBlocks.filterIsInstance<FlacMetadataBlock.VorbisComment>().size)
    }

    @Test
    fun `withVorbisComment should add block when none is present`() {
        val blocks = listOf<FlacMetadataBlock>(streamInfo)
        val file = readFlacFile(blocks)

        val newComment = FlacMetadataBlock.VorbisComment("added", listOf("ALBUM=Test"))
        val updated = file.withVorbisComment(newComment)

        val vc = updated.vorbisComment
        assertNotNull(vc)
        assertEquals("added", vc.vendor)
    }

    // -------------------------------------------------------------------------
    // FlacFile.updateVorbisComment
    // -------------------------------------------------------------------------

    @Test
    fun `updateVorbisComment should transform existing comment`() {
        val blocks = listOf<FlacMetadataBlock>(streamInfo, vorbisComment)
        val file = readFlacFile(blocks)

        val updated = file.updateVorbisComment { editor ->
            editor.set("TITLE", "Updated Title")
        }

        assertEquals("Updated Title", updated.vorbisComment?.get("TITLE"))
    }

    @Test
    fun `updateVorbisComment should create VorbisComment when none exists`() {
        val blocks = listOf<FlacMetadataBlock>(streamInfo)
        val file = readFlacFile(blocks)

        val updated = file.updateVorbisComment { editor ->
            editor.set("ALBUM", "New Album")
        }

        assertNotNull(updated.vorbisComment)
        assertEquals("New Album", updated.vorbisComment?.get("ALBUM"))
    }

    // -------------------------------------------------------------------------
    // VorbisCommentEditor.set
    // -------------------------------------------------------------------------

    @Test
    fun `VorbisCommentEditor set should replace existing key case-insensitively`() {
        val editor = VorbisCommentEditor("vendor", mutableListOf("TITLE=Original", "ALBUM=MyAlbum"))
        editor.set("title", "Replaced")
        val result = editor.build()

        assertEquals(1, result.comments.count { it.startsWith("TITLE=") })
        assertEquals("Replaced", result.get("TITLE"))
        assertEquals("MyAlbum", result.get("ALBUM"))
    }

    @Test
    fun `VorbisCommentEditor set should add key when not present`() {
        val editor = VorbisCommentEditor("vendor", mutableListOf())
        editor.set("ARTIST", "Miles Davis")
        val result = editor.build()

        assertEquals("Miles Davis", result.get("ARTIST"))
    }

    // -------------------------------------------------------------------------
    // VorbisCommentEditor.add
    // -------------------------------------------------------------------------

    @Test
    fun `VorbisCommentEditor add should append without removing existing values`() {
        val editor = VorbisCommentEditor("vendor", mutableListOf("ARTIST=Artist One"))
        editor.add("ARTIST", "Artist Two")
        val result = editor.build()

        assertEquals(2, result.getAll("ARTIST").size)
        assertTrue(result.getAll("ARTIST").contains("Artist One"))
        assertTrue(result.getAll("ARTIST").contains("Artist Two"))
    }

    // -------------------------------------------------------------------------
    // VorbisCommentEditor.remove
    // -------------------------------------------------------------------------

    @Test
    fun `VorbisCommentEditor remove should clear all values for key`() {
        val editor = VorbisCommentEditor(
            "vendor",
            mutableListOf("ARTIST=Artist One", "ARTIST=Artist Two", "ALBUM=MyAlbum"),
        )
        editor.remove("ARTIST")
        val result = editor.build()

        assertTrue(result.getAll("ARTIST").isEmpty())
        assertEquals("MyAlbum", result.get("ALBUM"))
    }

    @Test
    fun `VorbisCommentEditor remove is a no-op when key absent`() {
        val editor = VorbisCommentEditor("vendor", mutableListOf("ALBUM=MyAlbum"))
        editor.remove("TITLE")
        val result = editor.build()

        assertEquals(1, result.comments.size)
    }

    // -------------------------------------------------------------------------
    // VorbisComment.get / getAll / toMap
    // -------------------------------------------------------------------------

    @Test
    fun `VorbisComment get should return first value case-insensitively`() {
        val vc = FlacMetadataBlock.VorbisComment("v", listOf("title=Hello"))
        assertEquals("Hello", vc.get("TITLE"))
        assertEquals("Hello", vc.get("title"))
    }

    @Test
    fun `VorbisComment getAll should return all values for key`() {
        val vc = FlacMetadataBlock.VorbisComment("v", listOf("ARTIST=A", "ARTIST=B"))
        assertEquals(listOf("A", "B"), vc.getAll("ARTIST"))
    }

    @Test
    fun `VorbisComment get returns null for missing key`() {
        val vc = FlacMetadataBlock.VorbisComment("v", listOf("TITLE=Hello"))
        assertNull(vc.get("ALBUM"))
    }

    @Test
    fun `VorbisComment toMap groups by uppercase key`() {
        val vc = FlacMetadataBlock.VorbisComment("v", listOf("title=A", "TITLE=B", "ALBUM=C"))
        val map = vc.toMap()
        assertEquals(listOf("A", "B"), map["TITLE"])
        assertEquals(listOf("C"), map["ALBUM"])
    }

    // -------------------------------------------------------------------------
    // FlacWriter: padding behaviour
    // -------------------------------------------------------------------------

    @Test
    fun `FlacWriter should strip existing Padding blocks and add targetPaddingBytes`() {
        val blocks = listOf<FlacMetadataBlock>(
            streamInfo,
            FlacMetadataBlock.Padding(1000),
            vorbisComment,
        )
        val bytes = FlacWriter(targetPaddingBytes = 512).write(blocks, ByteArray(0))
        val result = FlacReader().parse(bytes)

        val paddings = result.blocks.filterIsInstance<FlacMetadataBlock.Padding>()
        assertEquals(1, paddings.size)
        assertEquals(512, paddings[0].length)
    }

    @Test
    fun `FlacWriter with zero padding should write no Padding block`() {
        val blocks = listOf<FlacMetadataBlock>(streamInfo, vorbisComment)
        val bytes = FlacWriter(targetPaddingBytes = 0).write(blocks, ByteArray(0))
        val result = FlacReader().parse(bytes)

        assertTrue(result.blocks.filterIsInstance<FlacMetadataBlock.Padding>().isEmpty())
    }

    // -------------------------------------------------------------------------
    // Unicode round-trip: non-ASCII Vorbis comment values (RFC 9639 §10)
    // -------------------------------------------------------------------------

    @Test
    fun `should round-trip German umlaut title through write then parse`() {
        val title = "Über die Brücke"
        val vc = roundTripVorbisComment("TITLE=$title")
        assertEquals(title, vc.get("TITLE"))
    }

    @Test
    fun `should round-trip CJK characters through write then parse`() {
        val value = "日本語"
        val vc = roundTripVorbisComment("ALBUM=$value")
        assertEquals(value, vc.get("ALBUM"))
    }

    @Test
    fun `should round-trip non-BMP emoji character through write then parse`() {
        val value = "🎵"
        val vc = roundTripVorbisComment("COMMENT=$value")
        assertEquals(value, vc.get("COMMENT"))
    }

    @Test
    fun `should round-trip empty string value through write then parse`() {
        val vc = roundTripVorbisComment("TITLE=")
        assertEquals("", vc.get("TITLE"))
    }

    @Test
    fun `should encode comment length as UTF-8 byte count not character count for multi-byte values`() {
        // "Über die Brücke" has 15 characters but more than 15 UTF-8 bytes (U+00DC and U+00FC
        // each encode to 2 bytes in UTF-8, so the comment is 17 bytes).
        // RFC 9639 §10 mandates that the length field is the UTF-8 byte count.
        // If the writer used character count the decoder would read too few bytes and corrupt the tag.
        val rawComment = "TITLE=Über die Brücke"
        val expectedByteLength = rawComment.toByteArray(Charsets.UTF_8).size
        assertTrue(expectedByteLength > rawComment.length, "Expected byte count to exceed character count")

        val blocks = listOf<FlacMetadataBlock>(streamInfo, FlacMetadataBlock.VorbisComment("test", listOf(rawComment)))
        val bytes = FlacWriter(targetPaddingBytes = 0).write(blocks, ByteArray(0))

        // Locate the VorbisComment block payload in the raw bytes and read the first comment length.
        // Layout (offsets from start of VorbisComment payload):
        //   [0..3]   vendor string length (LE uint32)
        //   [4..4+vendorLen-1] vendor bytes
        //   [4+vendorLen..4+vendorLen+3] comment count (LE uint32)
        //   [4+vendorLen+4..4+vendorLen+7] first comment length (LE uint32)  <- we want this
        val vcPayload = extractVorbisCommentPayload(bytes)
        val vcBuf = java.io.DataInputStream(vcPayload.inputStream())
        val vendorLen = readUInt32Le(vcBuf)
        vcBuf.skipBytes(vendorLen)
        @Suppress("UNUSED_VARIABLE") // comment count is read to advance the stream position
        val commentCount = readUInt32Le(vcBuf)
        val firstCommentByteLength = readUInt32Le(vcBuf)

        assertEquals(expectedByteLength, firstCommentByteLength,
            "Comment length field must be UTF-8 byte count ($expectedByteLength) not character count (${rawComment.length})")
    }

    @Test
    fun `should round-trip mixed-case field name with non-ASCII value`() {
        // RFC 9639 field names are ASCII and case-insensitive; values are UTF-8.
        val blocks = listOf<FlacMetadataBlock>(
            streamInfo,
            FlacMetadataBlock.VorbisComment("test", listOf("title=Über die Brücke")),
        )
        val bytes = FlacWriter().write(blocks, ByteArray(0))
        val result = FlacReader().parse(bytes)
        val vc = result.blocks.filterIsInstance<FlacMetadataBlock.VorbisComment>().first()

        // get() is case-insensitive per spec
        assertEquals("Über die Brücke", vc.get("TITLE"))
        assertEquals("Über die Brücke", vc.get("title"))
        assertEquals("Über die Brücke", vc.get("Title"))
    }

    @Test
    fun `should round-trip multiple non-ASCII values in a single VorbisComment block`() {
        val comments = listOf(
            "TITLE=Über die Brücke",
            "ARTIST=日本語バンド",
            "COMMENT=🎵",
            "ALBUM=",
        )
        val blocks = listOf<FlacMetadataBlock>(streamInfo, FlacMetadataBlock.VorbisComment("test", comments))
        val bytes = FlacWriter().write(blocks, ByteArray(0))
        val result = FlacReader().parse(bytes)
        val vc = result.blocks.filterIsInstance<FlacMetadataBlock.VorbisComment>().first()

        assertEquals("Über die Brücke", vc.get("TITLE"))
        assertEquals("日本語バンド", vc.get("ARTIST"))
        assertEquals("🎵", vc.get("COMMENT"))
        assertEquals("", vc.get("ALBUM"))
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private fun readFlacFile(blocks: List<FlacMetadataBlock>): FlacFile {
        val path = createTempFlacFile(blocks)
        return FlacFile.read(path)
    }

    private fun createTempFlacFile(blocks: List<FlacMetadataBlock>): kotlinx.io.files.Path {
        val bytes = FlacWriter().write(blocks, ByteArray(0))
        val tmpFile = java.io.File(System.getProperty("java.io.tmpdir"), "test-${System.nanoTime()}.flac")
        tmpFile.writeBytes(bytes)
        tmpFile.deleteOnExit()
        return kotlinx.io.files.Path(tmpFile.absolutePath)
    }

    /** Writes a single-comment VorbisComment block and returns the parsed block. */
    private fun roundTripVorbisComment(rawComment: String): FlacMetadataBlock.VorbisComment {
        val blocks = listOf<FlacMetadataBlock>(
            streamInfo,
            FlacMetadataBlock.VorbisComment("test", listOf(rawComment)),
        )
        val bytes = FlacWriter().write(blocks, ByteArray(0))
        val result = FlacReader().parse(bytes)
        return result.blocks.filterIsInstance<FlacMetadataBlock.VorbisComment>().first()
    }

    /**
     * Extracts the raw VorbisComment block payload bytes from a serialised FLAC file.
     * Walks the block headers to find the VorbisComment block (type 4) and returns its payload.
     */
    @Suppress("MagicNumber") // FLAC binary format constants per RFC 9639 §8-§10
    private fun extractVorbisCommentPayload(flacBytes: ByteArray): ByteArray {
        val buf = java.io.DataInputStream(flacBytes.inputStream())
        // Skip 'fLaC' marker (4 bytes)
        buf.skipBytes(4)
        var isLast = false
        while (!isLast) {
            val firstByte = buf.readByte().toInt() and 0xFF
            isLast = (firstByte and 0x80) != 0
            val blockType = firstByte and 0x7F
            val b0 = buf.readByte().toInt() and 0xFF
            val b1 = buf.readByte().toInt() and 0xFF
            val b2 = buf.readByte().toInt() and 0xFF
            val length = (b0 shl 16) or (b1 shl 8) or b2
            val payload = ByteArray(length)
            buf.readFully(payload)
            if (blockType == 4) return payload
        }
        error("No VorbisComment block found in FLAC bytes")
    }

    /** Reads a little-endian unsigned 32-bit integer from a DataInputStream as an Int. */
    @Suppress("MagicNumber") // little-endian bit-shift constants defined by the Vorbis Comment format
    private fun readUInt32Le(stream: java.io.DataInputStream): Int {
        val b0 = stream.readByte().toInt() and 0xFF
        val b1 = stream.readByte().toInt() and 0xFF
        val b2 = stream.readByte().toInt() and 0xFF
        val b3 = stream.readByte().toInt() and 0xFF
        return b0 or (b1 shl 8) or (b2 shl 16) or (b3 shl 24)
    }
}
