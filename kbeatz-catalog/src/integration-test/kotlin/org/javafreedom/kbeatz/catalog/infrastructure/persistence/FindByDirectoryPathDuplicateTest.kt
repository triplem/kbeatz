package org.javafreedom.kbeatz.catalog.infrastructure.persistence

import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertNotNull
import kotlinx.coroutines.test.runTest
import org.jetbrains.exposed.v1.core.dao.id.EntityID
import org.jetbrains.exposed.v1.jdbc.deleteAll
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.transactions.transaction

/**
 * Integration test for [ExposedAlbumRepository.findByDirectoryPath] when two rows in the
 * albums table share the same `directory_path` but have different natural keys
 * (albumArtist, album, albumDate).
 *
 * Context: the `uq_albums_dedup` unique constraint covers (album_artist, album, album_date),
 * NOT directory_path. So it is possible - though anomalous - for two rows to share the same
 * directory_path after data corruption or a failed dedup migration.
 *
 * Before issue #711, `findByDirectoryPath` used `.firstOrNull()` directly; the duplicate was
 * silently ignored. After #711 a WARN is logged. Either way, the function must not throw and
 * must return exactly one album (issue #714).
 */
class FindByDirectoryPathDuplicateTest {

    private val jdbcUrl =
        "jdbc:h2:mem:kbeatz_dedup_path_test_${System.nanoTime()};DB_CLOSE_DELAY=-1;MODE=PostgreSQL"

    @Test
    fun `findByDirectoryPath returns one album and does not throw when two rows share the same directoryPath`() =
        runTest {
            val ds = DbFactory.init(jdbcUrl)
            try {
                // Insert two rows with DIFFERENT natural keys (different albumArtist) but
                // the SAME directoryPath. This bypasses the repository's saveAll/save path
                // (which uses the natural key to dedup) and inserts directly to simulate a
                // data anomaly that could exist in a database that was not fully deduped.
                transaction {
                    AlbumsTable.insert {
                        it[id] = EntityID(UUID.randomUUID(), AlbumsTable)
                        it[albumArtist] = "Miles Davis"
                        it[album] = "Kind of Blue"
                        it[albumDate] = "1959"
                        it[directoryPath] = "jazz/shared-directory"
                    }
                    AlbumsTable.insert {
                        it[id] = EntityID(UUID.randomUUID(), AlbumsTable)
                        it[albumArtist] = "John Coltrane"
                        it[album] = "A Love Supreme"
                        it[albumDate] = "1964"
                        it[directoryPath] = "jazz/shared-directory"
                    }
                }

                val repo = ExposedAlbumRepository()

                // Must not throw (previously singleOrNull() would throw IllegalStateException)
                val result = repo.findByDirectoryPath("jazz/shared-directory")

                // Must return one album (not null)
                assertNotNull(result, "findByDirectoryPath must return one album when duplicates exist")
            } finally {
                transaction { AlbumsTable.deleteAll() }
                ds.close()
            }
        }

    @Test
    fun `findByDirectoryPath returns null when no album exists for the given path`() = runTest {
        val ds = DbFactory.init(jdbcUrl)
        try {
            val repo = ExposedAlbumRepository()
            val result = repo.findByDirectoryPath("jazz/nonexistent-directory")
            kotlin.test.assertNull(result, "findByDirectoryPath must return null for an unknown path")
        } finally {
            ds.close()
        }
    }

    @Test
    fun `findByDirectoryPath returns album when exactly one row matches the given path`() = runTest {
        val ds = DbFactory.init(jdbcUrl)
        try {
            transaction {
                AlbumsTable.insert {
                    it[id] = EntityID(UUID.randomUUID(), AlbumsTable)
                    it[albumArtist] = "Bach"
                    it[album] = "Goldberg Variations"
                    it[albumDate] = "1741"
                    it[directoryPath] = "baroque/bach/goldberg"
                }
            }

            val repo = ExposedAlbumRepository()
            val result = repo.findByDirectoryPath("baroque/bach/goldberg")

            assertNotNull(result, "findByDirectoryPath must return the album when exactly one row matches")
            kotlin.test.assertEquals("Bach", result.albumArtist)
            kotlin.test.assertEquals("Goldberg Variations", result.album)
        } finally {
            transaction { AlbumsTable.deleteAll() }
            ds.close()
        }
    }
}
