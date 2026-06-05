package org.javafreedom.kbeatz.sources

/**
 * Port: a source that can fetch release metadata by ID.
 *
 * Implementations: [discogs.DiscogsMetadataSource], musicbrainz.MusicBrainzMetadataSource (future).
 * Consumers: kbeatz-catalog (via dependency injection), kbeatz-tagger (CLI and service context).
 */
interface MetadataSource {

    /** Human-readable source name used as the [Release.sourceName] value (e.g. "discogs"). */
    val name: String

    /**
     * Fetches the release with the given [releaseId].
     * Returns null if the release does not exist; throws on network / auth failure.
     */
    suspend fun fetchRelease(releaseId: String): Release?

    /**
     * Downloads the image at position [index] in the release's image list.
     * Returns the raw image bytes (JPEG or PNG) and MIME type, or null if no such image.
     * Implementations must respect rate limits and quota.
     */
    suspend fun fetchImage(releaseId: String, index: Int): ImageResult?
}

data class ImageResult(
    val bytes: ByteArray,
    val mimeType: String,          // "image/jpeg" or "image/png"
)
