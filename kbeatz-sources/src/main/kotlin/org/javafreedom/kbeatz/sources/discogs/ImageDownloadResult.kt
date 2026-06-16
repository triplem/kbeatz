package org.javafreedom.kbeatz.sources.discogs

/**
 * Result of a single image download attempt made by
 * [DiscogsMetadataSource.downloadImages].
 */
sealed class ImageDownloadResult {
    /** Image was successfully downloaded and written to disk. */
    data class Downloaded(val pictureType: Int) : ImageDownloadResult()

    /**
     * Image was skipped without downloading.
     * Common reasons: file already exists and overwriteExisting=false, or pictureType
     * not found in metadata.json.
     */
    data class Skipped(val pictureType: Int, val reason: String) : ImageDownloadResult()

    /** Daily image quota was exhausted; no bytes were written. */
    data class QuotaExceeded(val pictureType: Int) : ImageDownloadResult()
}
