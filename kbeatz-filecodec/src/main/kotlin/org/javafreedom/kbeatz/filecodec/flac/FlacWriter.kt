package org.javafreedom.kbeatz.filecodec.flac

import kotlinx.io.Buffer
import kotlinx.io.Sink
import kotlinx.io.write
import kotlinx.io.writeIntLe

/**
 * Serialises FLAC metadata blocks to a [ByteArray] per RFC 9639 §8–§10.
 *
 * Write strategy:
 *  1. Strip any existing PADDING blocks.
 *  2. Write the FLAC marker, then updated metadata blocks.
 *  3. Append [targetPaddingBytes] of PADDING as the last metadata block.
 *  4. Append the unchanged audio frames.
 */
class FlacWriter(private val targetPaddingBytes: Int = 8192) {

    companion object {
        private val FLAC_MARKER = byteArrayOf(0x66, 0x4C, 0x61, 0x43) // "fLaC"
        private const val BLOCK_TYPE_STREAMINFO = 0
        private const val BLOCK_TYPE_PADDING = 1
        private const val BLOCK_TYPE_VORBIS_COMMENT = 4
        private const val BLOCK_TYPE_PICTURE = 6
    }

    fun write(blocks: List<FlacMetadataBlock>, audioFrames: ByteArray): ByteArray {
        val out = Buffer()
        val writeBlocks = blocks.filterNot { it is FlacMetadataBlock.Padding }

        out.write(FLAC_MARKER)
        writeBlocks.forEachIndexed { idx, block ->
            val isLast = idx == writeBlocks.lastIndex && targetPaddingBytes == 0
            out.write(encodeBlock(block, isLast))
        }
        if (targetPaddingBytes > 0) {
            out.write(encodePadding(targetPaddingBytes, isLast = true))
        }
        out.write(audioFrames)

        return out.readByteArray()
    }

    private fun encodeBlock(block: FlacMetadataBlock, isLast: Boolean): ByteArray =
        when (block) {
            is FlacMetadataBlock.StreamInfo    -> encodeRaw(BLOCK_TYPE_STREAMINFO,     encodeStreamInfo(block),    isLast)
            is FlacMetadataBlock.Padding       -> encodePadding(block.length, isLast)
            is FlacMetadataBlock.VorbisComment -> encodeRaw(BLOCK_TYPE_VORBIS_COMMENT, encodeVorbisComment(block), isLast)
            is FlacMetadataBlock.Picture       -> encodeRaw(BLOCK_TYPE_PICTURE,        encodePicture(block),       isLast)
            is FlacMetadataBlock.Unknown       -> encodeRaw(block.blockType,           block.data.toByteArray(),   isLast)
        }

    private fun encodeRaw(blockType: Int, data: ByteArray, isLast: Boolean): ByteArray {
        val buf = Buffer()
        buf.writeByte(((if (isLast) 0x80 else 0x00) or blockType).toByte())
        buf.writeInt24Be(data.size)
        buf.write(data)
        return buf.readByteArray()
    }

    private fun encodePadding(length: Int, isLast: Boolean): ByteArray =
        encodeRaw(BLOCK_TYPE_PADDING, ByteArray(length), isLast)

    private fun encodeStreamInfo(b: FlacMetadataBlock.StreamInfo): ByteArray {
        val sr = b.sampleRate.toLong()
        val ch = (b.channels - 1).toLong()
        val bps = (b.bitsPerSample - 1).toLong()
        val ts = b.totalSamples
        return Buffer().apply {
            writeShort(b.minBlockSize.toShort())
            writeShort(b.maxBlockSize.toShort())
            writeInt24Be(b.minFrameSize)
            writeInt24Be(b.maxFrameSize)
            writeByte(((sr shr 12) and 0xFF).toByte())
            writeByte(((sr shr 4) and 0xFF).toByte())
            writeByte((((sr and 0x0F) shl 4) or ((ch shl 1) and 0x0E) or ((bps shr 4) and 0x01)).toByte())
            writeByte((((bps and 0x0F) shl 4) or ((ts shr 32) and 0x0F)).toByte())
            writeByte(((ts shr 24) and 0xFF).toByte())
            writeByte(((ts shr 16) and 0xFF).toByte())
            writeByte(((ts shr 8) and 0xFF).toByte())
            writeByte((ts and 0xFF).toByte())
            write(b.md5.toByteArray())   // ByteString → ByteArray for Sink.write
        }.readByteArray()
    }

    private fun encodeVorbisComment(b: FlacMetadataBlock.VorbisComment): ByteArray {
        val vendorBytes = b.vendor.toByteArray(Charsets.UTF_8)
        return Buffer().apply {
            writeIntLe(vendorBytes.size)
            write(vendorBytes)
            writeIntLe(b.comments.size)
            b.comments.forEach { comment ->
                val bytes = comment.toByteArray(Charsets.UTF_8)
                writeIntLe(bytes.size)
                write(bytes)
            }
        }.readByteArray()
    }

    private fun encodePicture(b: FlacMetadataBlock.Picture): ByteArray {
        val mimeBytes = b.mimeType.toByteArray(Charsets.UTF_8)
        val descBytes = b.description.toByteArray(Charsets.UTF_8)
        return Buffer().apply {
            writeInt(b.pictureType)
            writeInt(mimeBytes.size); write(mimeBytes)
            writeInt(descBytes.size); write(descBytes)
            writeInt(b.width); writeInt(b.height)
            writeInt(b.colorDepth); writeInt(b.colorCount)
            writeInt(b.data.size); write(b.data.toByteArray())   // ByteString → ByteArray
        }.readByteArray()
    }
}

private fun Sink.writeInt24Be(value: Int) {
    writeByte(((value shr 16) and 0xFF).toByte())
    writeByte(((value shr 8) and 0xFF).toByte())
    writeByte((value and 0xFF).toByte())
}
