package org.javafreedom.kbeatz.sources

/**
 * Port: a cache for release metadata to avoid repeated API calls.
 *
 * Implementations: [cache.InMemoryMetadataCache] (v1, sufficient for personal use),
 * SqliteMetadataCache (future, for persistence across restarts).
 */
interface MetadataCache {

    /** Returns the cached release for [sourceName] + [releaseId], or null if not cached. */
    suspend fun get(sourceName: String, releaseId: String): Release?

    /** Stores [release] in the cache under [sourceName] + [releaseId]. */
    suspend fun put(sourceName: String, releaseId: String, release: Release)

    /** Removes the cached entry, forcing the next [get] to re-fetch from the source. */
    suspend fun invalidate(sourceName: String, releaseId: String)
}
