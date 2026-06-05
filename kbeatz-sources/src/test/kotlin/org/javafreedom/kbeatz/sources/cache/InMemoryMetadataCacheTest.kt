package org.javafreedom.kbeatz.sources.cache

import kotlinx.coroutines.runBlocking
import org.javafreedom.kbeatz.sources.Release
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

class InMemoryMetadataCacheTest {

    private fun release(id: String) = Release(
        sourceId = id,
        sourceName = "test",
        title = "T",
        artists = emptyList(),
        extraArtists = emptyList(),
        year = null,
        released = null,
        labels = emptyList(),
        genres = emptyList(),
        styles = emptyList(),
        country = null,
        notes = null,
        tracklist = emptyList(),
        images = emptyList(),
        masterUrl = null,
        resourceUrl = null,
        barcode = null,
    )

    // -------------------------------------------------------------------------
    // Basic get/put
    // -------------------------------------------------------------------------

    @Test
    fun `get returns null for missing key`() = runBlocking {
        val cache = InMemoryMetadataCache()

        val result = cache.get("discogs", "99999")

        assertNull(result)
    }

    @Test
    fun `put then get returns stored release`() = runBlocking {
        val cache = InMemoryMetadataCache()
        val rel = release("123")

        cache.put("discogs", "123", rel)
        val result = cache.get("discogs", "123")

        assertNotNull(result)
        assertEquals("123", result.sourceId)
    }

    @Test
    fun `get is keyed by both sourceName and releaseId`() = runBlocking {
        val cache = InMemoryMetadataCache()
        val relDiscogs = release("1").copy(sourceName = "discogs")
        val relMb = release("1").copy(sourceName = "musicbrainz")

        cache.put("discogs", "1", relDiscogs)
        cache.put("musicbrainz", "1", relMb)

        val fromDiscogs = cache.get("discogs", "1")
        val fromMb = cache.get("musicbrainz", "1")

        assertNotNull(fromDiscogs)
        assertNotNull(fromMb)
        assertEquals("discogs", fromDiscogs.sourceName)
        assertEquals("musicbrainz", fromMb.sourceName)
    }

    // -------------------------------------------------------------------------
    // Invalidate
    // -------------------------------------------------------------------------

    @Test
    fun `invalidate removes entry so next get returns null`() = runBlocking {
        val cache = InMemoryMetadataCache()
        cache.put("discogs", "456", release("456"))

        cache.invalidate("discogs", "456")
        val result = cache.get("discogs", "456")

        assertNull(result)
    }

    @Test
    fun `invalidate of absent key is a no-op`() = runBlocking {
        val cache = InMemoryMetadataCache()

        // Should not throw
        cache.invalidate("discogs", "nonexistent")
    }

    // -------------------------------------------------------------------------
    // LRU eviction
    // -------------------------------------------------------------------------

    @Test
    fun `oldest entry is evicted when maxEntries exceeded`() = runBlocking {
        val cache = InMemoryMetadataCache(maxEntries = 3)

        cache.put("src", "1", release("1"))
        cache.put("src", "2", release("2"))
        cache.put("src", "3", release("3"))
        // Adding a 4th entry should evict the oldest (key "1")
        cache.put("src", "4", release("4"))

        assertNull(cache.get("src", "1"))
        assertNotNull(cache.get("src", "2"))
        assertNotNull(cache.get("src", "3"))
        assertNotNull(cache.get("src", "4"))
    }

    @Test
    fun `recently accessed entry is not evicted before unaccessed one`() = runBlocking {
        val cache = InMemoryMetadataCache(maxEntries = 3)

        cache.put("src", "1", release("1"))
        cache.put("src", "2", release("2"))
        cache.put("src", "3", release("3"))
        // Access "1" to make it recently used
        cache.get("src", "1")
        // Adding "4" should now evict "2" (least recently used)
        cache.put("src", "4", release("4"))

        assertNotNull(cache.get("src", "1"))
        assertNull(cache.get("src", "2"))
        assertNotNull(cache.get("src", "3"))
        assertNotNull(cache.get("src", "4"))
    }

    // -------------------------------------------------------------------------
    // Update existing entry
    // -------------------------------------------------------------------------

    @Test
    fun `put overwrites existing entry for same key`() = runBlocking {
        val cache = InMemoryMetadataCache()
        cache.put("discogs", "789", release("789").copy(title = "Original"))
        cache.put("discogs", "789", release("789").copy(title = "Updated"))

        val result = cache.get("discogs", "789")

        assertNotNull(result)
        assertEquals("Updated", result.title)
    }
}
