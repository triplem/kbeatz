package org.javafreedom.kbeatz.sources.discogs

import java.nio.file.Path

/**
 * Result of a [DiscogsMetadataSource.syncAlbum] call.
 */
sealed class SyncResult {
    /** Both `source_discogs_<id>.json` and `metadata.json` were written successfully. */
    data class Success(val metadataPath: Path) : SyncResult()

    /**
     * The Discogs API responded with HTTP 429 or the rate-limit bucket is saturated.
     * The caller should retry after [retryAfterMs] milliseconds.
     */
    data class RateLimitExceeded(val retryAfterMs: Long) : SyncResult()

    /** Any other error (network failure, JSON parse error, IO error, etc.). */
    data class Error(val cause: Throwable) : SyncResult()
}
