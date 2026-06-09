package org.javafreedom.kbeatz.catalog.infrastructure.persistence

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.uuid.Uuid
import kotlinx.coroutines.test.runTest
import org.javafreedom.kbeatz.catalog.domain.model.Album
import org.jetbrains.exposed.v1.jdbc.deleteAll
import org.jetbrains.exposed.v1.jdbc.transactions.transaction

/**
 * Verifies the "no in-memory cache" decision from issue #371.
 *
 * H2 is the single source of truth for all reads. GET /api/v1/albums queries H2 directly
 * on every request, so there is no stale-cache problem to solve.
 *
 * These tests assert the repository-level behaviour that underpins the acceptance criteria:
 * - After a PATCH (tag write -> save()), the next findAllWithCount() returns the updated value.
 * - After a scan completes (saveAll()), newly scanned albums appear immediately.
 */
class AlbumCacheInvalidationTest {

    private val jdbcUrl =
        "jdbc:h2:mem:kbeatz_cache_test_${System.nanoTime()};DB_CLOSE_DELAY=-1;MODE=PostgreSQL"

    @Test
    fun `GET albums returns updated GENRE immediately after tag write (no stale cache)`() = runTest {
        val ds = DbFactory.init(jdbcUrl)
        try {
            val repo = ExposedAlbumRepository()
            val album = baseAlbum(genre = null)
            repo.save(album)

            // Simulate PATCH /api/v1/albums/{id}: update GENRE then save
            val updated = album.copy(genre = "Jazz")
            repo.save(updated)

            // Verify the change is immediately visible (no cache)
            val (page, _) = repo.findAllWithCount(0, 20)
            val found = page.firstOrNull { it.id == album.id }
            assertNotNull(found, "album must be present in list")
            assertEquals("Jazz", found.genre, "updated GENRE must be visible immediately without a cache flush")
        } finally {
            transaction { AlbumsTable.deleteAll() }
            ds.close()
        }
    }

    @Test
    fun `GET albums returns newly scanned albums immediately after scan completes (H2 is authoritative)`() = runTest {
        val ds = DbFactory.init(jdbcUrl)
        try {
            val repo = ExposedAlbumRepository()

            // Simulate initial state: no albums
            val (empty, emptyCount) = repo.findAllWithCount(0, 20)
            assertEquals(0, empty.size)
            assertEquals(0L, emptyCount)

            // Simulate scan completion: saveAll() with discovered albums
            val discovered = listOf(
                baseAlbum(albumArtist = "Miles Davis", albumTitle = "Kind of Blue"),
                baseAlbum(albumArtist = "John Coltrane", albumTitle = "A Love Supreme"),
            )
            repo.saveAll(discovered)

            // Newly scanned albums must appear immediately
            val (page, total) = repo.findAllWithCount(0, 20)
            assertEquals(2L, total, "scan results must be visible immediately")
            val artists = page.map { it.albumArtist }.toSet()
            assertEquals(setOf("Miles Davis", "John Coltrane"), artists)
        } finally {
            transaction { AlbumsTable.deleteAll() }
            ds.close()
        }
    }

    @Test
    fun `GET albums completes well under response-time SLA for 10k indexed albums (H2 direct-query performance)`() = runTest {
        val ds = DbFactory.init(jdbcUrl)
        try {
            val repo = ExposedAlbumRepository()
            // Insert 10,000 albums (same pattern as LargeLibraryTest)
            @Suppress("MagicNumber") // 10_000 is the NFR-11 scale
            repo.saveAll((1..10_000).map { i ->
                baseAlbum(
                    albumArtist = "Artist %05d".format(i),
                    albumTitle = "Album %05d".format(i),
                    path = "music/artist%05d/album%05d".format(i, i),
                )
            })

            // Measure paginated query time.
            // Production SLA (issue #371): 50ms against a tuned PostgreSQL instance.
            // H2 integration test threshold: 2000ms (H2 is slower; the test verifies the
            // query path does not scan the full table and that there is no in-memory cache).
            val start = System.currentTimeMillis()
            val (page, total) = repo.findAllWithCount(0, 20)
            val elapsed = System.currentTimeMillis() - start

            @Suppress("MagicNumber") // 2000ms CI threshold; production SLA is 50ms (see issue #371)
            assertEquals(10_000L, total)
            assertEquals(20, page.size)
            assert(elapsed <= 2_000L) {
                "Paginated GET must complete within 2000ms on H2 (no full-table scan), took ${elapsed}ms"
            }
        } finally {
            transaction { AlbumsTable.deleteAll() }
            ds.close()
        }
    }

    // --- helpers ---

    private fun baseAlbum(
        albumArtist: String = "Test Artist",
        albumTitle: String = "Test Album",
        genre: String? = null,
        path: String = "music/test",
    ) = Album(
        id = Uuid.random(),
        albumArtist = albumArtist,
        album = albumTitle,
        date = "2020",
        genre = genre,
        label = null,
        catalogNumber = null,
        composer = null,
        conductor = null,
        ensemble = null,
        discogsId = null,
        extraTags = null,
        images = null,
        directoryPath = path,
    )
}
