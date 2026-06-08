package org.javafreedom.kbeatz.tagger.codec.flac

import kotlinx.io.Buffer
import kotlinx.io.Source
import kotlinx.io.bytestring.ByteString
import kotlinx.io.bytestring.encodeToByteString
import kotlinx.io.readByteArray
import kotlinx.io.readByteString
import kotlinx.io.readUIntLe
import kotlinx.io.write

/**
 * Reads FLAC metadata blocks from a [ByteArray] per RFC 9639 §8–§9.
 * Only metadata blocks are parsed; audio frame data is not touched.
 */
class FlacReader {

    companion object {
        private val FLAC_MARKER: ByteString = "fLaC".encodeToByteString()
        private const val BLOCK_TYPE_STREAMINFO = 0
        private const val BLOCK_TYPE_PADDING = 1
        private const val BLOCK_TYPE_VORBIS_COMMENT = 4
        private const val BLOCK_TYPE_PICTURE = 6
        private const val LAST_BLOCK_FLAG = 0x80
        private const val BLOCK_TYPE_MASK = 0x7F
        private const val BYTE_MASK = 0xFF
        private const val USHORT_MASK = 0xFFFF
        private const val MD5_SIZE = 16
    }

    /**
     * Parses all metadata blocks from [data] (the full FLAC file content).
     * Returns the parsed blocks and the raw audio frames that follow.
     *
     * @throws FlacParseException if [data] does not start with a valid FLAC marker,
     *   or if the file is truncated or otherwise malformed.
     */
    @Suppress("TooGenericExceptionCaught", "SwallowedException")
    // kotlinx.io raises various RuntimeException subtypes (EOFException, IllegalStateException)
    // on truncated data - catching the base type is intentional so all truncation scenarios are
    // wrapped in FlacParseException with the original cause preserved.
    fun parse(data: ByteArray): FlacParseResult {
        val source = Buffer().apply { write(data) }

        if (source.readByteString(FLAC_MARKER.size) != FLAC_MARKER) {
            throw FlacParseException("Not a FLAC file: missing 'fLaC' marker")
        }

        val blocks = mutableListOf<FlacMetadataBlock>()
        var isLast = false
        var blockIndex = 0
        var lastKnownBlockType = -1

        try {
            while (!isLast) {
                val firstByte = source.readByte().toInt() and BYTE_MASK
                isLast = (firstByte and LAST_BLOCK_FLAG) != 0
                val blockType = firstByte and BLOCK_TYPE_MASK
                lastKnownBlockType = blockType
                val length = source.readInt24Be()
                val blockData = source.readByteArray(length)

                blocks += when (blockType) {
                    BLOCK_TYPE_STREAMINFO -> parseStreamInfo(blockData)
                    BLOCK_TYPE_PADDING -> FlacMetadataBlock.Padding(length)
                    BLOCK_TYPE_VORBIS_COMMENT -> parseVorbisComment(blockData)
                    BLOCK_TYPE_PICTURE -> parsePicture(blockData)
                    else -> FlacMetadataBlock.Unknown(blockType, ByteString(blockData))
                }
                blockIndex++
            }
        } catch (e: FlacParseException) {
            throw e
        } catch (e: Exception) {
            throw FlacParseException(
                "Truncated or malformed FLAC file: failed reading block " +
                    "type=$lastKnownBlockType at index=$blockIndex (cause: ${e.message})",
                e,
            )
        }

        return FlacParseResult(blocks, source.readByteArray())
    }

    @Suppress("MagicNumber") // FLAC StreamInfo bit-field layout per RFC 9639 §9.2
    private fun parseStreamInfo(data: ByteArray): FlacMetadataBlock.StreamInfo {
        val p = Buffer().apply { write(data) }
        val minBlockSize = p.readShort().toInt() and USHORT_MASK
        val maxBlockSize = p.readShort().toInt() and USHORT_MASK
        val minFrameSize = p.readInt24Be()
        val maxFrameSize = p.readInt24Be()
        val b0 = p.readByte().toLong() and 0xFF
        val b1 = p.readByte().toLong() and 0xFF
        val b2 = p.readByte().toLong() and 0xFF
        val b3 = p.readByte().toLong() and 0xFF
        val b4 = p.readByte().toLong() and 0xFF
        val b5 = p.readByte().toLong() and 0xFF
        val b6 = p.readByte().toLong() and 0xFF
        val b7 = p.readByte().toLong() and 0xFF
        val sampleRate = ((b0 shl 12) or (b1 shl 4) or (b2 shr 4)).toInt()
        val channels = (((b2 and 0x0E) shr 1) + 1).toInt()
        val bitsPerSample = ((((b2 and 0x01) shl 4) or (b3 shr 4)) + 1).toInt()
        val totalSamples = ((b3 and 0x0F) shl 32) or (b4 shl 24) or (b5 shl 16) or (b6 shl 8) or b7
        val md5 = p.readByteString(MD5_SIZE)   // ByteString - value-semantic MD5
        return FlacMetadataBlock.StreamInfo(
            minBlockSize, maxBlockSize, minFrameSize, maxFrameSize,
            sampleRate, channels, bitsPerSample, totalSamples, md5,
        )
    }

    private fun parseVorbisComment(data: ByteArray): FlacMetadataBlock.VorbisComment {
        val p = Buffer().apply { write(data) }
        val vendor = p.readByteArray(p.readUIntLe().toInt()).decodeToString()
        val count = p.readUIntLe().toInt()
        val comments = (0 until count).map { p.readByteArray(p.readUIntLe().toInt()).decodeToString() }
        return FlacMetadataBlock.VorbisComment(vendor, comments)
    }

    private fun parsePicture(data: ByteArray): FlacMetadataBlock.Picture {
        val p = Buffer().apply { write(data) }
        val pictureType = p.readInt()
        val mimeType = p.readByteArray(p.readInt()).decodeToString()
        val description = p.readByteArray(p.readInt()).decodeToString()
        val width = p.readInt()
        val height = p.readInt()
        val colorDepth = p.readInt()
        val colorCount = p.readInt()
        val picData = p.readByteString(p.readInt())   // ByteString - value-semantic image data
        return FlacMetadataBlock.Picture(
            pictureType, mimeType, description, width, height, colorDepth, colorCount, picData,
        )
    }
}

/**
 * Parsed FLAC content: the metadata blocks and the raw audio frames that follow them.
 *
 * Intentionally a plain class (not data class) - [audioFrames] is a large [ByteArray]
 * and auto-generated equals/hashCode on arrays uses reference equality, which is wrong.
 * Test assertions should compare [blocks] and [audioFrames] fields individually.
 */
class FlacParseResult(
    val blocks: List<FlacMetadataBlock>,
    val audioFrames: ByteArray,
)

class FlacParseException(message: String, cause: Throwable? = null) : RuntimeException(message, cause)

@Suppress("MagicNumber") // 24-bit big-endian read: bit-shift constants are defined by the format
private fun Source.readInt24Be(): Int {
    val b0 = readByte().toInt() and 0xFF
    val b1 = readByte().toInt() and 0xFF
    val b2 = readByte().toInt() and 0xFF
    return (b0 shl 16) or (b1 shl 8) or b2
}
