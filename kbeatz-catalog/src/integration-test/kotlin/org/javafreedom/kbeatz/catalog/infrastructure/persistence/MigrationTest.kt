package org.javafreedom.kbeatz.catalog.infrastructure.persistence

import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.uuid.Uuid
import kotlinx.coroutines.test.runTest
import org.javafreedom.kbeatz.catalog.domain.model.Album
import org.javafreedom.kbeatz.catalog.domain.model.Track
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.deleteAll
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.transaction

private fun Uuid.asJavaUuid(): UUID = UUID.fromString(this.toString())

/**
 * Integration tests verifying the V1__baseline Liquibase migration and Exposed ORM.
 *
 * Tests run against an H2 in-memory database matching the production schema.
 * All ACs from story #57 are covered:
 * - Tables + constraints created correctly
 * - Migration is idempotent
 * - UNIQUE constraint prevents duplicates
 * - discogs_json stores raw JSON
 * - extra_tags and images nullable
 * - FK CASCADE DELETE
 */
class MigrationTest {

    private val jdbcUrl =
        "jdbc:h2:mem:kbeatz_test_${System.nanoTime()};DB_CLOSE_DELAY=-1;MODE=PostgreSQL"

    @Test
    fun `schema creates albums and tracks tables`() = runTest {
        val ds = DbFactory.init(jdbcUrl)
        try {
            transaction {
                val albumCount = AlbumsTable.selectAll().count()
                val trackCount = TracksTable.selectAll().count()
                assertEquals(0L, albumCount)
                assertEquals(0L, trackCount)
            }
        } finally {
            ds.close()
        }
    }

    @Test
    fun `migration is idempotent on restart`() = runTest {
        // First init
        val ds1 = DbFactory.init(jdbcUrl)
        ds1.close()
        // Second init on same URL (simulates restart)
        val ds2 = DbFactory.init(jdbcUrl)
        try {
            transaction {
                assertEquals(0L, AlbumsTable.selectAll().count())
            }
        } finally {
            ds2.close()
        }
    }

    @Test
    fun `albums insert and read back all fields`() = runTest {
        val ds = DbFactory.init(jdbcUrl)
        try {
            val albumId = Uuid.random()
            transaction {
                AlbumsTable.insert {
                    it[id] = org.jetbrains.exposed.v1.core.dao.id.EntityID(
                        albumId.asJavaUuid(), AlbumsTable
                    )
                    it[albumArtist] = "Miles Davis"
                    it[album] = "Kind of Blue"
                    it[albumDate] = "1959"
                    it[genre] = "Jazz"
                    it[label] = "Columbia"
                    it[catalogNumber] = null
                    it[composer] = null
                    it[conductor] = null
                    it[ensemble] = null
                    it[discogsId] = null
                    it[discogsJson] = null
                    it[extraTags] = null
                    it[images] = null
                    it[directoryPath] = "jazz/miles-davis/kind-of-blue"
                }
            }
            transaction {
                val row = AlbumsTable.selectAll()
                    .where { AlbumsTable.id eq albumId.asJavaUuid() }
                    .single()
                assertEquals("Miles Davis", row[AlbumsTable.albumArtist])
                assertEquals("Kind of Blue", row[AlbumsTable.album])
                assertEquals("1959", row[AlbumsTable.albumDate])
                assertNull(row[AlbumsTable.extraTags])
                assertNull(row[AlbumsTable.images])
            }
        } finally {
            transaction { AlbumsTable.deleteAll() }
            ds.close()
        }
    }

    @Test
    fun `unique constraint prevents duplicate albums`() = runTest {
        val ds = DbFactory.init(jdbcUrl)
        try {
            val albumId1 = Uuid.random()
            val albumId2 = Uuid.random()
            transaction {
                AlbumsTable.insert {
                    it[id] = org.jetbrains.exposed.v1.core.dao.id.EntityID(
                        albumId1.asJavaUuid(), AlbumsTable
                    )
                    it[albumArtist] = "Test Artist"
                    it[album] = "Test Album"
                    it[albumDate] = "2020"
                    it[directoryPath] = "test/artist/album"
                }
            }
            var uniqueViolated = false
            try {
                transaction {
                    AlbumsTable.insert {
                        it[id] = org.jetbrains.exposed.v1.core.dao.id.EntityID(
                            albumId2.asJavaUuid(), AlbumsTable
                        )
                        it[albumArtist] = "Test Artist"
                        it[album] = "Test Album"
                        it[albumDate] = "2020"
                        it[directoryPath] = "test/artist/album"
                    }
                }
            } catch (e: Exception) {
                uniqueViolated = true
            }
            assertTrue(uniqueViolated, "Expected unique constraint violation")
        } finally {
            transaction { AlbumsTable.deleteAll() }
            ds.close()
        }
    }

    @Test
    fun `discogs_json stores raw JSON string`() = runTest {
        val ds = DbFactory.init(jdbcUrl)
        try {
            val albumId = Uuid.random()
            val rawJson = """{"id":12345,"title":"Kind of Blue","year":1959}"""
            transaction {
                AlbumsTable.insert {
                    it[id] = org.jetbrains.exposed.v1.core.dao.id.EntityID(
                        albumId.asJavaUuid(), AlbumsTable
                    )
                    it[albumArtist] = "Miles Davis"
                    it[album] = "Kind of Blue"
                    it[albumDate] = "1959"
                    it[directoryPath] = "jazz/kind-of-blue"
                    it[discogsJson] = rawJson
                }
            }
            transaction {
                val row = AlbumsTable.selectAll()
                    .where { AlbumsTable.id eq albumId.asJavaUuid() }
                    .single()
                assertEquals(rawJson, row[AlbumsTable.discogsJson])
            }
        } finally {
            transaction { AlbumsTable.deleteAll() }
            ds.close()
        }
    }

    @Test
    fun `extra_tags round-trips JSON string`() = runTest {
        val ds = DbFactory.init(jdbcUrl)
        try {
            val albumId = Uuid.random()
            val extraTagsJson = """{"BARCODE":"012345678","STYLE":"Modal Jazz"}"""
            transaction {
                AlbumsTable.insert {
                    it[id] = org.jetbrains.exposed.v1.core.dao.id.EntityID(
                        albumId.asJavaUuid(), AlbumsTable
                    )
                    it[albumArtist] = "Miles Davis"
                    it[album] = "Kind of Blue"
                    it[albumDate] = "1959"
                    it[directoryPath] = "jazz/kind-of-blue-extra"
                    it[extraTags] = extraTagsJson
                }
            }
            transaction {
                val row = AlbumsTable.selectAll()
                    .where { AlbumsTable.id eq albumId.asJavaUuid() }
                    .single()
                assertEquals(extraTagsJson, row[AlbumsTable.extraTags])
            }
        } finally {
            transaction { AlbumsTable.deleteAll() }
            ds.close()
        }
    }

    @Test
    fun `tracks are cascade deleted when parent album is deleted`() = runTest {
        val ds = DbFactory.init(jdbcUrl)
        try {
            val albumId = Uuid.random()
            val trackId = Uuid.random()
            transaction {
                AlbumsTable.insert {
                    it[id] = org.jetbrains.exposed.v1.core.dao.id.EntityID(
                        albumId.asJavaUuid(), AlbumsTable
                    )
                    it[albumArtist] = "Miles Davis"
                    it[album] = "Kind of Blue"
                    it[albumDate] = "1959"
                    it[directoryPath] = "jazz/kind-of-blue-cascade"
                }
                TracksTable.insert {
                    it[id] = org.jetbrains.exposed.v1.core.dao.id.EntityID(
                        trackId.asJavaUuid(), TracksTable
                    )
                    it[TracksTable.albumId] = albumId.asJavaUuid()
                    it[trackPath] = "01 - So What.flac"
                }
            }
            // Verify track exists
            transaction {
                val count = TracksTable.selectAll()
                    .where { TracksTable.albumId eq albumId.asJavaUuid() }
                    .count()
                assertEquals(1L, count, "Track should exist before album delete")
            }
            // Delete album
            transaction {
                AlbumsTable.deleteAll()
            }
            // Verify track was cascade deleted
            transaction {
                val count = TracksTable.selectAll()
                    .where { TracksTable.albumId eq albumId.asJavaUuid() }
                    .count()
                assertEquals(0L, count, "Track should be cascade deleted with album")
            }
        } finally {
            ds.close()
        }
    }

    @Test
    fun `ExposedAlbumRepository save and findById round-trip`() = runTest {
        val ds = DbFactory.init(jdbcUrl)
        try {
            val repo = ExposedAlbumRepository()
            val album = org.javafreedom.kbeatz.catalog.domain.model.Album(
                id = Uuid.random(),
                albumArtist = "Johann Sebastian Bach",
                album = "Goldberg Variations",
                date = "1741",
                genre = "Baroque",
                label = null,
                catalogNumber = null,
                composer = "Johann Sebastian Bach",
                conductor = null,
                ensemble = null,
                discogsId = null,
                extraTags = mapOf("STYLE" to "Keyboard"),
                images = null,
                directoryPath = "baroque/bach/goldberg",
            )
            repo.save(album)
            val found = repo.findById(album.id)
            assertNotNull(found)
            assertEquals(album.albumArtist, found.albumArtist)
            assertEquals(album.composer, found.composer)
            assertEquals(mapOf("STYLE" to "Keyboard"), found.extraTags)
        } finally {
            transaction { AlbumsTable.deleteAll() }
            ds.close()
        }
    }

    @Test
    fun `ExposedAlbumRepository findAllWithCount returns total and paginated results`() = runTest {
        val ds = DbFactory.init(jdbcUrl)
        try {
            val repo = ExposedAlbumRepository()
            val albums = (1..5).map { i ->
                Album(
                    id = Uuid.random(),
                    albumArtist = "Artist $i",
                    album = "Album $i",
                    date = "200$i",
                    genre = null,
                    label = null,
                    catalogNumber = null,
                    composer = null,
                    conductor = null,
                    ensemble = null,
                    discogsId = null,
                    extraTags = null,
                    images = null,
                    directoryPath = "music/artist$i",
                )
            }
            albums.forEach { repo.save(it) }
            val (page, total) = repo.findAllWithCount(0, 3)
            assertEquals(5L, total)
            assertEquals(3, page.size)
        } finally {
            transaction { AlbumsTable.deleteAll() }
            ds.close()
        }
    }

    @Test
    fun `ExposedAlbumRepository saveAll persists multiple albums`() = runTest {
        val ds = DbFactory.init(jdbcUrl)
        try {
            val repo = ExposedAlbumRepository()
            val albums = listOf(
                Album(
                    id = Uuid.random(), albumArtist = "Bach", album = "BWV 998",
                    date = "1720", genre = "Baroque", label = null, catalogNumber = null,
                    composer = "Bach", conductor = null, ensemble = null, discogsId = null,
                    extraTags = null, images = null, directoryPath = "baroque/bach/bwv998",
                ),
                Album(
                    id = Uuid.random(), albumArtist = "Mozart", album = "K. 331",
                    date = "1783", genre = "Classical", label = null, catalogNumber = null,
                    composer = "Mozart", conductor = null, ensemble = null, discogsId = null,
                    extraTags = null, images = null, directoryPath = "classical/mozart/k331",
                ),
            )
            repo.saveAll(albums)
            assertEquals(2L, repo.findAllWithCount(0, Int.MAX_VALUE).second)
        } finally {
            transaction { AlbumsTable.deleteAll() }
            ds.close()
        }
    }

    @Test
    fun `ExposedTrackRepository saveAll and findByAlbumId round-trip`() = runTest {
        val ds = DbFactory.init(jdbcUrl)
        try {
            val albumRepo = ExposedAlbumRepository()
            val trackRepo = ExposedTrackRepository()
            val album = Album(
                id = Uuid.random(), albumArtist = "Miles Davis", album = "Kind of Blue",
                date = "1959", genre = "Jazz", label = null, catalogNumber = null,
                composer = null, conductor = null, ensemble = null, discogsId = null,
                extraTags = null, images = null, directoryPath = "jazz/kind-of-blue",
            )
            albumRepo.save(album)
            val tracks = listOf(
                Track(
                    id = Uuid.random(), albumId = album.id, title = "So What",
                    trackNumber = "1", discNumber = null, trackTotal = "6", discTotal = null,
                    artist = null, composer = "Miles Davis", conductor = null, ensemble = null,
                    durationSeconds = 565, path = "01 - So What.flac",
                    images = null, extraTags = null,
                ),
                Track(
                    id = Uuid.random(), albumId = album.id, title = "Freddie Freeloader",
                    trackNumber = "2", discNumber = null, trackTotal = "6", discTotal = null,
                    artist = null, composer = "Miles Davis", conductor = null, ensemble = null,
                    durationSeconds = 584, path = "02 - Freddie Freeloader.flac",
                    images = null, extraTags = mapOf("STYLE" to "Modal Jazz"),
                ),
            )
            trackRepo.saveAll(tracks)
            val found = trackRepo.findByAlbumId(album.id)
            assertEquals(2, found.size)
            assertEquals("So What", found.first { it.trackNumber == "1" }.title)
            assertEquals(mapOf("STYLE" to "Modal Jazz"), found.first { it.trackNumber == "2" }.extraTags)
        } finally {
            transaction { AlbumsTable.deleteAll() }
            ds.close()
        }
    }

    @Test
    fun `saveAll inserts new albums and leaves genre unchanged for existing albums`() = runTest {
        val ds = DbFactory.init(jdbcUrl)
        try {
            val repo = ExposedAlbumRepository()

            // Seed one album with a genre set
            val existingId = Uuid.random()
            val existing = Album(
                id = existingId, albumArtist = "Bach", album = "BWV 999",
                date = "1720", genre = "Baroque", label = null, catalogNumber = null,
                composer = null, conductor = null, ensemble = null, discogsId = null,
                extraTags = null, images = null, directoryPath = "baroque/bach/bwv999",
            )
            repo.save(existing)

            // saveAll simulates a rescan: same album with null genre (as AlbumGroup.toAlbum() produces),
            // plus a genuinely new album
            val newId = Uuid.random()
            repo.saveAll(listOf(
                existing.copy(genre = null), // rescan produces null genre
                Album(
                    id = newId, albumArtist = "Mozart", album = "K. 300",
                    date = "1780", genre = "Classical", label = null, catalogNumber = null,
                    composer = null, conductor = null, ensemble = null, discogsId = null,
                    extraTags = null, images = null, directoryPath = "classical/mozart/k300",
                ), // new insert
            ))

            assertEquals(2L, repo.findAllWithCount(0, Int.MAX_VALUE).second)
            val updated = repo.findById(existingId)
            assertNotNull(updated)
            // Structural-only update: genre must NOT be overwritten with null from the rescan
            assertEquals("Baroque", updated.genre, "genre should be preserved across rescan")
            val inserted = repo.findById(newId)
            assertNotNull(inserted, "new album should be inserted")
        } finally {
            transaction { AlbumsTable.deleteAll() }
            ds.close()
        }
    }

    @Test
    fun `saveAll preserves all Discogs-enriched metadata across rescan`() = runTest {
        val ds = DbFactory.init(jdbcUrl)
        try {
            val repo = ExposedAlbumRepository()

            // Insert album with full Discogs metadata
            val albumId = Uuid.random()
            val enriched = Album(
                id = albumId,
                albumArtist = "Miles Davis",
                album = "Kind of Blue",
                date = "1959",
                genre = "Jazz",
                label = "Columbia",
                catalogNumber = "CL 1355",
                composer = null,
                conductor = null,
                ensemble = null,
                discogsId = "d1234567",
                extraTags = mapOf("STYLE" to "Modal Jazz"),
                images = null,
                directoryPath = "jazz/miles-davis/kind-of-blue",
            )
            repo.save(enriched)

            // Simulate a library rescan: AlbumGroup.toAlbum() produces an album with all
            // enriched fields set to null
            repo.saveAll(listOf(
                Album(
                    id = Uuid.random(), // fresh UUID; saveAll resolves to existingId by natural key
                    albumArtist = "Miles Davis",
                    album = "Kind of Blue",
                    date = "1959",
                    genre = null,
                    label = null,
                    catalogNumber = null,
                    composer = null,
                    conductor = null,
                    ensemble = null,
                    discogsId = null,
                    extraTags = null,
                    images = null,
                    directoryPath = "jazz/miles-davis/kind-of-blue",
                ),
            ))

            val found = repo.findById(albumId)
            assertNotNull(found)
            assertEquals("Jazz", found.genre, "genre must survive rescan")
            assertEquals("Columbia", found.label, "label must survive rescan")
            assertEquals("CL 1355", found.catalogNumber, "catalogNumber must survive rescan")
            assertEquals("d1234567", found.discogsId, "discogsId must survive rescan")
        } finally {
            transaction { AlbumsTable.deleteAll() }
            ds.close()
        }
    }

    @Test
    fun `saveAll processes large batch in chunks without error`() = runTest {
        val ds = DbFactory.init(jdbcUrl)
        try {
            val repo = ExposedAlbumRepository()
            // 1 200 albums = 3 chunks of 500/500/200 (SAVE_ALL_CHUNK_SIZE = 500)
            val albums = (1..1200).map { i ->
                Album(
                    id = Uuid.random(),
                    albumArtist = "Artist $i",
                    album = "Album $i",
                    date = "2000",
                    genre = null,
                    label = null,
                    catalogNumber = null,
                    composer = null,
                    conductor = null,
                    ensemble = null,
                    discogsId = null,
                    extraTags = null,
                    images = null,
                    directoryPath = "music/artist$i/album$i",
                )
            }
            repo.saveAll(albums)
            assertEquals(1200L, repo.findAllWithCount(0, Int.MAX_VALUE).second)
        } finally {
            transaction { AlbumsTable.deleteAll() }
            ds.close()
        }
    }

    @Test
    fun `saveAll with empty list is a no-op`() = runTest {
        val ds = DbFactory.init(jdbcUrl)
        try {
            val repo = ExposedAlbumRepository()
            repo.saveAll(emptyList())
            assertEquals(0L, repo.findAllWithCount(0, Int.MAX_VALUE).second)
        } finally {
            ds.close()
        }
    }

    // --- Deduplication tests (issue #657) ---

    @Test
    fun `unique constraint prevents duplicate albums with same artist album date from different directories`() =
        runTest {
            // The new constraint is (album_artist, album, album_date) without directory_path.
            // Two rows with same (artist, album, date) but DIFFERENT paths must violate the constraint.
            val ds = DbFactory.init(jdbcUrl)
            try {
                val albumId1 = Uuid.random()
                val albumId2 = Uuid.random()
                transaction {
                    AlbumsTable.insert {
                        it[id] = org.jetbrains.exposed.v1.core.dao.id.EntityID(
                            albumId1.asJavaUuid(), AlbumsTable
                        )
                        it[albumArtist] = "Dedup Artist"
                        it[album] = "Dedup Album"
                        it[albumDate] = "2024"
                        it[directoryPath] = "music/dir1"
                    }
                }
                var uniqueViolated = false
                try {
                    transaction {
                        AlbumsTable.insert {
                            it[id] = org.jetbrains.exposed.v1.core.dao.id.EntityID(
                                albumId2.asJavaUuid(), AlbumsTable
                            )
                            it[albumArtist] = "Dedup Artist"
                            it[album] = "Dedup Album"
                            it[albumDate] = "2024"
                            it[directoryPath] = "music/dir2" // different path, same album
                        }
                    }
                } catch (e: Exception) {
                    uniqueViolated = true
                }
                assertTrue(uniqueViolated, "Two rows with same (artist, album, date) must violate uq_albums_dedup")
            } finally {
                transaction { AlbumsTable.deleteAll() }
                ds.close()
            }
        }

    @Test
    fun `saveAll deduplicates albums from different directories with same artist album and date`() = runTest {
        // Issue #657: scanning same album from two different directories must produce ONE entry.
        val ds = DbFactory.init(jdbcUrl)
        try {
            val repo = ExposedAlbumRepository()
            val albumFromDir1 = Album(
                id = Uuid.random(),
                albumArtist = "Miles Davis",
                album = "Kind of Blue",
                date = "1959",
                genre = null,
                label = null,
                catalogNumber = null,
                composer = null,
                conductor = null,
                ensemble = null,
                discogsId = null,
                extraTags = null,
                images = null,
                directoryPath = "jazz/kind-of-blue-lossless",
            )
            val albumFromDir2 = albumFromDir1.copy(
                id = Uuid.random(),
                directoryPath = "jazz/kind-of-blue-backup",
            )

            // Save the first album, then call saveAll with BOTH (simulating a rescan that
            // encounters the same release in two directories after LibraryWalker deduplication).
            repo.save(albumFromDir1)
            // saveAll with the same natural key must update, not insert a second row
            repo.saveAll(listOf(albumFromDir2))

            val (_, total) = repo.findAllWithCount(0, Int.MAX_VALUE)
            assertEquals(1L, total, "two directories with same (artist, album, date) must produce one catalogue entry")
        } finally {
            transaction { AlbumsTable.deleteAll() }
            ds.close()
        }
    }

    @Test
    fun `saveAll keeps two albums with same artist and title but different dates as separate entries`() = runTest {
        // Disambiguation: same artist + title + DIFFERENT year = separate albums
        val ds = DbFactory.init(jdbcUrl)
        try {
            val repo = ExposedAlbumRepository()
            repo.saveAll(listOf(
                Album(
                    id = Uuid.random(),
                    albumArtist = "Miles Davis",
                    album = "Kind of Blue",
                    date = "1959",
                    genre = null, label = null, catalogNumber = null, composer = null,
                    conductor = null, ensemble = null, discogsId = null,
                    extraTags = null, images = null,
                    directoryPath = "jazz/kind-of-blue-original",
                ),
                Album(
                    id = Uuid.random(),
                    albumArtist = "Miles Davis",
                    album = "Kind of Blue",
                    date = "2014", // remaster year
                    genre = null, label = null, catalogNumber = null, composer = null,
                    conductor = null, ensemble = null, discogsId = null,
                    extraTags = null, images = null,
                    directoryPath = "jazz/kind-of-blue-remaster",
                ),
            ))

            val (_, total) = repo.findAllWithCount(0, Int.MAX_VALUE)
            assertEquals(2L, total, "different DATE tags must produce separate catalogue entries")
        } finally {
            transaction { AlbumsTable.deleteAll() }
            ds.close()
        }
    }

    @Test
    fun `saveAll called from repair path with null enriched fields does not wipe existing metadata`() = runTest {
        // Regression test for issue #206: repairOnStartup() calls saveAll() with albums produced
        // by AlbumGroup.toAlbum() which has all enriched fields set to null. The structural-only
        // update path must leave previously-set Discogs metadata untouched.
        val ds = DbFactory.init(jdbcUrl)
        try {
            val repo = ExposedAlbumRepository()

            // Insert album with full Discogs metadata
            val albumId = Uuid.random()
            val enriched = Album(
                id = albumId,
                albumArtist = "John Coltrane",
                album = "A Love Supreme",
                date = "1964",
                genre = "Jazz",
                label = "Impulse!",
                catalogNumber = "AS-77",
                composer = "John Coltrane",
                conductor = null,
                ensemble = null,
                discogsId = "d7654321",
                extraTags = null,
                images = null,
                directoryPath = "jazz/coltrane/love-supreme",
            )
            repo.save(enriched)

            // Simulate repairOnStartup: passes album with all enriched fields null
            // (exactly what AlbumGroup.toAlbum() produces in LibraryScanService)
            repo.saveAll(listOf(
                Album(
                    id = Uuid.random(),
                    albumArtist = "John Coltrane",
                    album = "A Love Supreme",
                    date = "1964",
                    genre = null,
                    label = null,
                    catalogNumber = null,
                    composer = null,
                    conductor = null,
                    ensemble = null,
                    discogsId = null,
                    extraTags = null,
                    images = null,
                    directoryPath = "jazz/coltrane/love-supreme",
                ),
            ))

            val found = repo.findById(albumId)
            assertNotNull(found)
            assertEquals("Jazz", found.genre, "genre must not be wiped by repair path")
            assertEquals("Impulse!", found.label, "label must not be wiped by repair path")
            assertEquals("AS-77", found.catalogNumber, "catalogNumber must not be wiped by repair path")
            assertEquals("d7654321", found.discogsId, "discogsId must not be wiped by repair path")
        } finally {
            transaction { AlbumsTable.deleteAll() }
            ds.close()
        }
    }

    @Test
    fun `ExposedTrackRepository deleteByAlbumId removes tracks`() = runTest {
        val ds = DbFactory.init(jdbcUrl)
        try {
            val albumRepo = ExposedAlbumRepository()
            val trackRepo = ExposedTrackRepository()
            val album = Album(
                id = Uuid.random(), albumArtist = "Coltrane", album = "A Love Supreme",
                date = "1964", genre = "Jazz", label = null, catalogNumber = null,
                composer = null, conductor = null, ensemble = null, discogsId = null,
                extraTags = null, images = null, directoryPath = "jazz/coltrane/love-supreme",
            )
            albumRepo.save(album)
            trackRepo.saveAll(listOf(
                Track(
                    id = Uuid.random(), albumId = album.id, title = "Acknowledgement",
                    trackNumber = "1", discNumber = null, trackTotal = "4", discTotal = null,
                    artist = null, composer = null, conductor = null, ensemble = null,
                    durationSeconds = 420, path = "01 - Acknowledgement.flac",
                    images = null, extraTags = null,
                ),
            ))
            assertEquals(1, trackRepo.findByAlbumId(album.id).size)
            trackRepo.deleteByAlbumId(album.id)
            assertEquals(0, trackRepo.findByAlbumId(album.id).size)
        } finally {
            transaction { AlbumsTable.deleteAll() }
            ds.close()
        }
    }

}
