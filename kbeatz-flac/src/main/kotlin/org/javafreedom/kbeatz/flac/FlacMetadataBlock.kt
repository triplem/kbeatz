package org.javafreedom.kbeatz.flac

import kotlinx.io.bytestring.ByteString

/**
 * Sealed hierarchy of FLAC metadata block types as defined in RFC 9639 §9.
 * Block type numbers match the spec's BLOCK_TYPE values.
 *
 * All byte-array fields use [ByteString] (immutable, value-semantic) rather than [ByteArray]
 * to guarantee correct equals/hashCode behaviour in data classes and test assertions.
 */
sealed class FlacMetadataBlock {

    /** RFC 9639 §9.1 — stream info, always the first block. */
    data class StreamInfo(
        val minBlockSize: Int,
        val maxBlockSize: Int,
        val minFrameSize: Int,
        val maxFrameSize: Int,
        val sampleRate: Int,
        val channels: Int,
        val bitsPerSample: Int,
        val totalSamples: Long,
        val md5: ByteString,         // 16 bytes — ByteString gives content-based equals
    ) : FlacMetadataBlock()

    /** RFC 9639 §9.2 — zero-fill padding for editing headroom. */
    data class Padding(val length: Int) : FlacMetadataBlock()

    /** RFC 9639 §9.4 — Vorbis comment block (human-readable tags). */
    data class VorbisComment(
        val vendor: String,
        val comments: List<String>,   // raw "KEY=value" strings
    ) : FlacMetadataBlock() {

        // Lazily built once — O(n) on first access, O(1) on subsequent reads.
        private val tagMap: Map<String, List<String>> by lazy(LazyThreadSafetyMode.NONE) {
            comments
                .mapNotNull { it.split('=', limit = 2).takeIf { p -> p.size == 2 } }
                .groupBy({ it[0].uppercase() }, { it[1] })
        }

        fun toMap(): Map<String, List<String>> = tagMap

        fun get(key: String): String? = tagMap[key.uppercase()]?.firstOrNull()

        fun getAll(key: String): List<String> = tagMap[key.uppercase()] ?: emptyList()
    }

    /** RFC 9639 §9.6 — embedded cover art. */
    data class Picture(
        val pictureType: Int,
        val mimeType: String,
        val description: String,
        val width: Int,
        val height: Int,
        val colorDepth: Int,
        val colorCount: Int,
        val data: ByteString,        // ByteString gives content-based equals for image data
    ) : FlacMetadataBlock() {
        companion object {
            const val TYPE_FRONT_COVER = 3
            const val TYPE_BACK_COVER = 4
            const val TYPE_LEAFLET = 5
            const val TYPE_MEDIA = 6
        }
    }

    /** Any block type not explicitly parsed — preserved verbatim on write. */
    data class Unknown(
        val blockType: Int,
        val data: ByteString,        // ByteString gives content-based equals
    ) : FlacMetadataBlock()
}

/** Standard Vorbis Comment field names used by kbeatz (RFC 9639 §10 + community conventions). */
object VorbisCommentFields {
    const val TITLE = "TITLE"
    const val ALBUM = "ALBUM"
    const val ARTIST = "ARTIST"
    const val ALBUMARTIST = "ALBUMARTIST"
    const val ALBUMARTIST_SORT = "ALBUMARTISTSORT"
    const val COMPOSER = "COMPOSER"
    const val CONDUCTOR = "CONDUCTOR"
    const val ENSEMBLE = "ENSEMBLE"
    const val DATE = "DATE"
    const val YEAR = "YEAR"
    const val GENRE = "GENRE"
    const val STYLE = "STYLE"
    const val GROUPING = "GROUPING"
    const val TRACKNUMBER = "TRACKNUMBER"
    const val TRACKTOTAL = "TRACKTOTAL"
    const val DISCNUMBER = "DISCNUMBER"
    const val DISCTOTAL = "DISCTOTAL"
    const val LABEL = "LABEL"
    const val CATALOGNUMBER = "CATALOGNUMBER"
    const val BARCODE = "BARCODE"
    const val ENCODER = "ENCODER"
    const val COMMENT = "COMMENT"

    const val DISCOGS_ID = "DISCOGS_ID"
    const val DISCOGS_RELEASE_URL = "DISCOGS_RELEASE_URL"
    const val DISCOGS_MASTER_ID = "DISCOGS_MASTER_ID"
    const val MUSICBRAINZ_ALBUMID = "MUSICBRAINZ_ALBUMID"
    const val MUSICBRAINZ_TRACKID = "MUSICBRAINZ_TRACKID"
    const val MUSICBRAINZ_ARTISTID = "MUSICBRAINZ_ARTISTID"
}
