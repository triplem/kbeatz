package org.javafreedom.kbeatz.tagger.codec.flac

import kotlinx.io.bytestring.ByteString
import java.io.File

/**
 * Generates minimal FLAC fixture files for codec tests.
 *
 * Run once to produce binary .flac files that are committed to source control:
 *   ./gradlew :kbeatz-tagger:test --tests "*.GenerateFixturesTest"
 *
 * The generated files are read from the classpath in the actual codec tests.
 */
object FixtureGenerator {

    private val md5Zeros = ByteString(ByteArray(16))

    /** Known StreamInfo values shared by all generated fixtures. */
    const val SAMPLE_RATE = 44100
    const val CHANNELS = 2
    const val BITS_PER_SAMPLE = 16
    const val TOTAL_SAMPLES = 4410L   // 100ms of silence — keeps fixture files under 20 KB

    /** Known VorbisComment tag values in with-tags.flac and with-cover.flac. */
    const val TAG_TITLE = "Kind of Blue"
    const val TAG_ARTIST = "Miles Davis"
    const val TAG_ALBUM = "Kind of Blue"
    const val TAG_TRACKNUMBER = "1"
    const val TAG_DATE = "1959"
    const val TAG_GENRE = "Jazz"
    const val TAG_VENDOR = "kbeatz-test"

    /** Known PICTURE block values in with-cover.flac. */
    const val PICTURE_TYPE = 3            // Front cover per FLAC spec
    const val PICTURE_MIME = "image/jpeg"
    const val PICTURE_WIDTH = 1
    const val PICTURE_HEIGHT = 1
    const val PICTURE_COLOR_DEPTH = 24
    const val PICTURE_COLOR_COUNT = 0
    val PICTURE_BYTE_LENGTH: Int get() = MINIMAL_JPEG.size

    fun generate(fixturesDir: File) {
        fixturesDir.mkdirs()
        writeWithTags(File(fixturesDir, "with-tags.flac"))
        writeWithCover(File(fixturesDir, "with-cover.flac"))
        writeCorrupted(File(fixturesDir, "corrupted.flac"))
    }

    private fun streamInfo() = FlacMetadataBlock.StreamInfo(
        minBlockSize = 4096,
        maxBlockSize = 4096,
        minFrameSize = 0,
        maxFrameSize = 0,
        sampleRate = SAMPLE_RATE,
        channels = CHANNELS,
        bitsPerSample = BITS_PER_SAMPLE,
        totalSamples = TOTAL_SAMPLES,
        md5 = md5Zeros,
    )

    private fun vorbisComment() = FlacMetadataBlock.VorbisComment(
        vendor = TAG_VENDOR,
        comments = listOf(
            "TITLE=$TAG_TITLE",
            "ARTIST=$TAG_ARTIST",
            "ALBUM=$TAG_ALBUM",
            "TRACKNUMBER=$TAG_TRACKNUMBER",
            "DATE=$TAG_DATE",
            "GENRE=$TAG_GENRE",
        ),
    )

    private fun picture() = FlacMetadataBlock.Picture(
        pictureType = PICTURE_TYPE,
        mimeType = PICTURE_MIME,
        description = "",
        width = PICTURE_WIDTH,
        height = PICTURE_HEIGHT,
        colorDepth = PICTURE_COLOR_DEPTH,
        colorCount = PICTURE_COLOR_COUNT,
        data = ByteString(MINIMAL_JPEG),
    )

    /**
     * Silence: 1 second at 44100 Hz, 16-bit stereo.
     * The audio data is raw PCM zeros. FlacReader treats everything after the last
     * metadata block as opaque audio-frame bytes, so no FLAC frame encoding is needed.
     */
    @Suppress("MagicNumber") // 2 channels * 2 bytes per sample * totalSamples
    private fun silenceAudio(): ByteArray = ByteArray(TOTAL_SAMPLES.toInt() * CHANNELS * 2)

    private fun writeWithTags(file: File) {
        val blocks = listOf(streamInfo(), vorbisComment())
        file.writeBytes(FlacWriter(targetPaddingBytes = 0).write(blocks, silenceAudio()))
    }

    private fun writeWithCover(file: File) {
        val blocks = listOf(streamInfo(), vorbisComment(), picture())
        file.writeBytes(FlacWriter(targetPaddingBytes = 0).write(blocks, silenceAudio()))
    }

    private fun writeCorrupted(file: File) {
        // Valid fLaC marker followed by a truncated STREAMINFO header (only 6 bytes instead of
        // the required 4-byte marker + 4-byte block-header + 34-byte StreamInfo body).
        // FlacReader will throw FlacParseException when it tries to read the block.
        file.writeBytes(byteArrayOf(
            0x66, 0x4C, 0x61, 0x43,  // fLaC marker
            0x00, 0x00,              // truncated: only 2 bytes of the first block header
        ))
    }
}

/**
 * Minimal valid 1x1 pixel JPEG image used as the embedded cover art fixture.
 *
 * This is a standards-compliant JFIF JPEG with a single white pixel, produced
 * from the JPEG specification baseline DCT format. Kept here as a byte literal
 * so the test suite has no external tool dependency.
 */
@Suppress("MagicNumber") // JPEG binary format constants defined by the JPEG specification (ISO 10918-1)
val MINIMAL_JPEG: ByteArray = byteArrayOf(
    // SOI - Start Of Image
    0xFF.toByte(), 0xD8.toByte(),
    // APP0 - JFIF application marker
    0xFF.toByte(), 0xE0.toByte(),
    0x00.toByte(), 0x10.toByte(),                                     // APP0 length = 16
    0x4A.toByte(), 0x46.toByte(), 0x49.toByte(), 0x46.toByte(), 0x00.toByte(), // "JFIF\0"
    0x01.toByte(), 0x01.toByte(),                                     // JFIF version 1.1
    0x00.toByte(),                                                    // pixel aspect ratio: none
    0x00.toByte(), 0x01.toByte(),                                     // X density = 1
    0x00.toByte(), 0x01.toByte(),                                     // Y density = 1
    0x00.toByte(), 0x00.toByte(),                                     // no embedded thumbnail
    // DQT - Define Quantization Table (64 luminance coefficients, quality ~50)
    0xFF.toByte(), 0xDB.toByte(),
    0x00.toByte(), 0x43.toByte(),                                     // DQT length = 67
    0x00.toByte(),                                                    // table 0, 8-bit precision
    0x10.toByte(), 0x0B.toByte(), 0x0C.toByte(), 0x0E.toByte(), 0x0C.toByte(),
    0x0A.toByte(), 0x10.toByte(), 0x0E.toByte(), 0x0D.toByte(), 0x0E.toByte(),
    0x12.toByte(), 0x11.toByte(), 0x10.toByte(), 0x13.toByte(), 0x18.toByte(),
    0x28.toByte(), 0x1A.toByte(), 0x18.toByte(), 0x16.toByte(), 0x16.toByte(),
    0x18.toByte(), 0x31.toByte(), 0x23.toByte(), 0x25.toByte(), 0x1D.toByte(),
    0x28.toByte(), 0x3A.toByte(), 0x33.toByte(), 0x3D.toByte(), 0x3C.toByte(),
    0x39.toByte(), 0x33.toByte(), 0x38.toByte(), 0x37.toByte(), 0x40.toByte(),
    0x48.toByte(), 0x5C.toByte(), 0x4E.toByte(), 0x40.toByte(), 0x44.toByte(),
    0x57.toByte(), 0x45.toByte(), 0x37.toByte(), 0x38.toByte(), 0x50.toByte(),
    0x6D.toByte(), 0x51.toByte(), 0x57.toByte(), 0x60.toByte(), 0x62.toByte(),
    0x67.toByte(), 0x68.toByte(), 0x67.toByte(), 0x3E.toByte(), 0x4D.toByte(),
    0x71.toByte(), 0x79.toByte(), 0x70.toByte(), 0x64.toByte(), 0x78.toByte(),
    0x5C.toByte(), 0x65.toByte(), 0x67.toByte(), 0x63.toByte(),
    // SOF0 - Start Of Frame (baseline DCT, 1x1 pixel, 1 component = grayscale)
    0xFF.toByte(), 0xC0.toByte(),
    0x00.toByte(), 0x0B.toByte(),                                     // SOF0 length = 11
    0x08.toByte(),                                                    // 8-bit sample precision
    0x00.toByte(), 0x01.toByte(),                                     // image height = 1
    0x00.toByte(), 0x01.toByte(),                                     // image width = 1
    0x01.toByte(),                                                    // 1 component (Y only)
    0x01.toByte(), 0x11.toByte(), 0x00.toByte(),                      // component: Y, 1x1, table 0
    // DHT - Define Huffman Table (DC, table 0)
    0xFF.toByte(), 0xC4.toByte(),
    0x00.toByte(), 0x1F.toByte(),                                     // DHT length = 31
    0x00.toByte(),                                                    // DC table 0
    0x00.toByte(), 0x01.toByte(), 0x05.toByte(), 0x01.toByte(), 0x01.toByte(),
    0x01.toByte(), 0x01.toByte(), 0x01.toByte(), 0x01.toByte(), 0x00.toByte(),
    0x00.toByte(), 0x00.toByte(), 0x00.toByte(), 0x00.toByte(), 0x00.toByte(),
    0x00.toByte(), 0x00.toByte(), 0x01.toByte(), 0x02.toByte(), 0x03.toByte(),
    0x04.toByte(), 0x05.toByte(), 0x06.toByte(), 0x07.toByte(), 0x08.toByte(),
    0x09.toByte(), 0x0A.toByte(), 0x0B.toByte(),
    // DHT - Define Huffman Table (AC, table 0)
    0xFF.toByte(), 0xC4.toByte(),
    0x00.toByte(), 0x1F.toByte(),                                     // DHT length = 31
    0x10.toByte(),                                                    // AC table 0
    0x00.toByte(), 0x02.toByte(), 0x01.toByte(), 0x03.toByte(), 0x03.toByte(),
    0x02.toByte(), 0x04.toByte(), 0x03.toByte(), 0x05.toByte(), 0x05.toByte(),
    0x04.toByte(), 0x04.toByte(), 0x00.toByte(), 0x00.toByte(), 0x01.toByte(),
    0x7D.toByte(), 0x01.toByte(), 0x02.toByte(), 0x03.toByte(), 0x00.toByte(),
    0x04.toByte(), 0x11.toByte(), 0x05.toByte(), 0x12.toByte(), 0x21.toByte(),
    0x31.toByte(), 0x41.toByte(),
    // SOS - Start Of Scan
    0xFF.toByte(), 0xDA.toByte(),
    0x00.toByte(), 0x08.toByte(),                                     // SOS length = 8
    0x01.toByte(),                                                    // 1 component
    0x01.toByte(), 0x00.toByte(),                                     // component 1, table 0
    0x00.toByte(), 0x3F.toByte(), 0x00.toByte(),                      // spectral selection 0-63
    // Entropy-coded data (single white pixel DC coefficient = 0, no AC)
    0x7F.toByte(), 0xFF.toByte(),
    // EOI - End Of Image
    0xFF.toByte(), 0xD9.toByte(),
)
