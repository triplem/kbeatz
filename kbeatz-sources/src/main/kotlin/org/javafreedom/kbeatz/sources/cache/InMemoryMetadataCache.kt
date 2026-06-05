package org.javafreedom.kbeatz.sources.cache

import org.javafreedom.kbeatz.sources.MetadataCache
import org.javafreedom.kbeatz.sources.Release

/**
 * Thread-safe in-memory cache backed by a [LinkedHashMap] with LRU eviction.
 * Sufficient for v1: a personal collection session rarely needs more than a few hundred releases.
 *
 * Replace with SqliteMetadataCache when persistence across restarts is required.
 */
class InMemoryMetadataCache(private val maxEntries: Int = 500) : MetadataCache {

    private val store = object : LinkedHashMap<String, Release>(maxEntries, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, Release>?) =
            size > maxEntries
    }

    override suspend fun get(sourceName: String, releaseId: String): Release? =
        synchronized(store) { store[key(sourceName, releaseId)] }

    override suspend fun put(sourceName: String, releaseId: String, release: Release) =
        synchronized(store) { store[key(sourceName, releaseId)] = release }

    override suspend fun invalidate(sourceName: String, releaseId: String) =
        synchronized(store) { store.remove(key(sourceName, releaseId)) }.let { }

    private fun key(sourceName: String, releaseId: String) = "$sourceName:$releaseId"
}
