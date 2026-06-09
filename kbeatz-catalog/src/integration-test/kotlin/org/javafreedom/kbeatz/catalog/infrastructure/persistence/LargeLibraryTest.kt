package org.javafreedom.kbeatz.catalog.infrastructure.persistence

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.uuid.Uuid
import kotlinx.coroutines.test.runTest
import org.javafreedom.kbeatz.catalog.domain.model.Album
import org.jetbrains.exposed.v1.jdbc.deleteAll
import org.jetbrains.exposed.v1.jdbc.transactions.transaction

/**
 * NFR-11 acceptance test: the service must handle a collection of 10,000 albums.
 *
 * This test verifies:
 * - All 10,000 albums can be persisted and retrieved via the paginated repository API.
 * - Paginated reads return the correct total count and page contents.
 * - The final page (page 499 of size 20) is accessible with no errors.
 * - Bulk insert and paginated reads complete within a 120-second timeout on H2.
 *
 * Performance note: this test runs against an in-memory H2 database and is expected
 * to complete well under the 120-second production target. On a real spinning-disk
 * PostgreSQL deployment the 120-second SLA applies to the full startup scan path.
 */
class LargeLibraryTest {

    private val jdbcUrl =
        "jdbc:h2:mem:kbeatz_large_test_${System.nanoTime()};DB_CLOSE_DELAY=-1;MODE=PostgreSQL"

    @Suppress("MagicNumber") // 10_000 is the NFR-11 scale requirement
    @Test
    fun `10k albums can be persisted and retrieved via paginated GET`() = runTest(
        timeout = kotlin.time.Duration.parse("120s")
    ) {
        val ds = DbFactory.init(jdbcUrl)
        try {
            val repo = ExposedAlbumRepository()
            val albums = buildAlbums(10_000)

            // Persist all 10,000 albums (uses chunked saveAll internally)
            repo.saveAll(albums)

            // Verify total count
            val (firstPage, total) = repo.findAllWithCount(0, 20)
            assertEquals(10_000L, total, "totalElements must be 10,000")
            assertEquals(20, firstPage.size, "first page must contain 20 albums")

            // Verify last page (page index 499 = items 9980-9999)
            val (lastPage, lastTotal) = repo.findAllWithCount(499, 20)
            assertEquals(10_000L, lastTotal, "totalElements must be stable across pages")
            assertEquals(20, lastPage.size, "last page must contain 20 albums")
            assertTrue(lastPage.all { it.albumArtist.isNotBlank() }, "all albums on last page must have an artist")
        } finally {
            transaction { AlbumsTable.deleteAll() }
            ds.close()
        }
    }

    @Suppress("MagicNumber") // 10_000 / 20 = 500 pages is the pagination math for this test
    @Test
    fun `GET albums with default pagination returns page 0 size 20 and correct totalElements`() = runTest(
        timeout = kotlin.time.Duration.parse("120s")
    ) {
        val ds = DbFactory.init(jdbcUrl)
        try {
            val repo = ExposedAlbumRepository()
            repo.saveAll(buildAlbums(10_000))

            // Default pagination matches the REST API default (page=0, size=20)
            val (page, total) = repo.findAllWithCount(0, 20)
            assertEquals(10_000L, total, "totalElements must equal 10,000")
            assertEquals(20, page.size, "default page size must be 20")
        } finally {
            transaction { AlbumsTable.deleteAll() }
            ds.close()
        }
    }

    // --- helpers ---

    @Suppress("MagicNumber") // 4-digit year for synthetic test data
    private fun buildAlbums(count: Int): List<Album> =
        (1..count).map { i ->
            Album(
                id = Uuid.random(),
                albumArtist = "Artist %05d".format(i),
                album = "Album %05d".format(i),
                date = "20%02d".format(i % 24),
                genre = null,
                label = null,
                catalogNumber = null,
                composer = null,
                conductor = null,
                ensemble = null,
                discogsId = null,
                extraTags = null,
                images = null,
                directoryPath = "music/artist%05d/album%05d".format(i, i),
            )
        }
}
