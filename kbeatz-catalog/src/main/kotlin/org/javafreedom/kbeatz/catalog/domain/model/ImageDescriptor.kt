package org.javafreedom.kbeatz.catalog.domain.model

/**
 * Describes a single image associated with an album or track.
 *
 * Used in the [Album.images] and [Track.images] fields, serialised to/from
 * JSON at the persistence boundary.
 *
 * @property pictureType FLAC PICTURE block type per RFC 9639 §9.3 (3 = front cover, etc.)
 * @property source Whether the image is a standalone file or embedded in a FLAC file.
 * @property path Relative path:
 *   - [ImageSource.FILE]: image filename relative to album directory (e.g. "folder.jpg")
 *   - [ImageSource.EMBEDDED]: track path relative to album directory (e.g. "01 - foo.flac")
 * @property mimeType MIME type (e.g. "image/jpeg")
 * @property description FLAC PICTURE description field; empty string if absent
 */
data class ImageDescriptor(
    val pictureType: Int,
    val source: ImageSource,
    val path: String,
    val mimeType: String,
    val description: String,
)

enum class ImageSource {
    FILE,
    EMBEDDED,
}
