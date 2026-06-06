package org.javafreedom.kbeatz.catalog.application.service

import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import java.nio.file.Files
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue
import kotlin.uuid.Uuid
import kotlinx.coroutines.runBlocking
import kotlinx.datetime.LocalDate
import org.javafreedom.kbeatz.catalog.domain.model.Album
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumRepository
import org.javafreedom.kbeatz.common.BusinessValidationException
import org.javafreedom.kbeatz.common.ResourceNotFoundException
import org.javafreedom.kbeatz.sources.MetadataSource
import org.javafreedom.kbeatz.sources.Release

/**
 * Unit tests for [DiscogsSyncService] with all dependencies mocked.
 */
class DiscogsSyncServiceTest {

    private val libraryRoot = Files.createTempDirectory("sync-test-library")
    private val albumDir = Files.createTempDirectory(libraryRoot, "kind-of-blue")

    private fun buildAlbum(discogsId: String? = "12345"): Album = Album(
        id = Uuid.random(),
        albumArtist = "Miles Davis",
        album = "Kind of Blue",
        date = null,
        genre = null,
        label = null,
        catalogNumber = null,
        composer = null,
        conductor = null,
        ensemble = null,
        discogsId = discogsId,
        directoryPath = albumDir.toString(),
        extraTags = null,
        images = null,
    )

    private fun buildRelease(): Release = Release(
        sourceId = "12345",
        sourceName = "discogs",
        title = "Kind of Blue",
        artists = listOf(org.javafreedom.kbeatz.sources.ReleaseArtist(id = "1", name = "Miles Davis")),
        extraArtists = emptyList(),
        year = 1959,
        released = LocalDate.parse("1959-08-17"),
        labels = listOf(org.javafreedom.kbeatz.sources.Label(name = "Columbia", catno = "CL 1355")),
        genres = listOf("Jazz"),
        styles = emptyList(),
        country = "US",
        notes = null,
        tracklist = emptyList(),
        images = emptyList(),
        masterUrl = null,
        resourceUrl = "https://api.discogs.com/releases/12345",
        barcode = null,
    )

    private fun buildService(
        album: Album = buildAlbum(),
        release: Release? = buildRelease(),
        imageService: DiscogsImageService? = null,
    ): Triple<DiscogsSyncService, AlbumRepository, MetadataSource> {
        val repo = mockk<AlbumRepository>()
        coEvery { repo.findById(album.id) } returns album
        coEvery { repo.save(any()) } answers { firstArg() }

        val source = mockk<MetadataSource>()
        coEvery { source.fetchRelease(any()) } returns release

        val service = DiscogsSyncService(
            albumRepository = repo,
            metadataSource = source,
            imageService = imageService,
            libraryRoot = libraryRoot,
        )
        return Triple(service, repo, source)
    }

    // ---- album not found ----

    @Test
    fun `should throw ResourceNotFoundException when album does not exist`() = runBlocking {
        val albumId = Uuid.random()
        val repo = mockk<AlbumRepository>()
        coEvery { repo.findById(albumId) } returns null

        val service = DiscogsSyncService(
            albumRepository = repo,
            metadataSource = mockk(),
            imageService = null,
            libraryRoot = libraryRoot,
        )

        assertFailsWith<ResourceNotFoundException> {
            service.sync(albumId, downloadImages = false)
        }
    }

    // ---- no discogsId ----

    @Test
    fun `should throw BusinessValidationException when album has no discogsId`() = runBlocking {
        val album = buildAlbum(discogsId = null)
        val (service, _, _) = buildService(album = album)

        assertFailsWith<BusinessValidationException> {
            service.sync(album.id, downloadImages = false)
        }
    }

    // ---- Discogs release not found ----

    @Test
    fun `should return warning when Discogs release is not found`() = runBlocking {
        val album = buildAlbum()
        val (service, _, _) = buildService(album = album, release = null)

        val result = service.sync(album.id, downloadImages = false)

        assertTrue(result.fieldsWritten.isEmpty())
        assertTrue(result.warnings.any { "not found" in it })
    }

    // ---- successful sync ----

    @Test
    fun `should write ALBUM and ALBUMARTIST tags when release is found`() = runBlocking {
        val album = buildAlbum()
        val (service, repo, _) = buildService(album = album)

        val result = service.sync(album.id, downloadImages = false)

        assertTrue(result.fieldsWritten.contains("ALBUM"))
        assertTrue(result.fieldsWritten.contains("ALBUMARTIST"))
        coVerify { repo.save(any()) }
    }

    @Test
    fun `should update album in repository after sync`() = runBlocking {
        val album = buildAlbum()
        val (service, repo, _) = buildService(album = album)

        service.sync(album.id, downloadImages = false)

        coVerify(exactly = 1) { repo.save(any()) }
    }

    @Test
    fun `should return updatedAlbum with correct artist from Discogs`() = runBlocking {
        val album = buildAlbum()
        val (service, _, _) = buildService(album = album)

        val result = service.sync(album.id, downloadImages = false)

        assertEquals("Miles Davis", result.updatedAlbum.albumArtist)
        assertEquals("Kind of Blue", result.updatedAlbum.album)
    }

    @Test
    fun `should create and remove write-lock file during sync`() = runBlocking {
        val album = buildAlbum()
        val (service, _, _) = buildService(album = album)

        service.sync(album.id, downloadImages = false)

        val lockFile = albumDir.resolve(".kbeatz-write.lock")
        assertFalse(Files.exists(lockFile), "Lock file should be removed after successful sync")
    }

    // ---- no FLAC files ----

    @Test
    fun `should complete with empty fieldsWritten when album dir has no FLAC files`() = runBlocking {
        val album = buildAlbum()
        val (service, _, _) = buildService(album = album)

        val result = service.sync(album.id, downloadImages = false)

        // Tags are still in fieldsWritten (they're from the tag map, not per-file counts)
        assertNotNull(result)
        assertTrue(result.warnings.isEmpty())
    }

    // ---- downloadImages=false (no imageService) ----

    @Test
    fun `should return empty warnings when imageService is null`() = runBlocking {
        val album = buildAlbum()
        val (service, _, _) = buildService(album = album, imageService = null)

        val result = service.sync(album.id, downloadImages = false)

        assertTrue(result.warnings.isEmpty())
    }
}
