package org.javafreedom.kbeatz.catalog.application.service

import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.uuid.Uuid
import kotlinx.coroutines.test.runTest
import org.javafreedom.kbeatz.catalog.domain.model.Album
import org.javafreedom.kbeatz.catalog.domain.model.Track
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumRepository
import org.javafreedom.kbeatz.catalog.domain.repository.TrackRepository
import org.javafreedom.kbeatz.common.ResourceNotFoundException

class AlbumServiceTest {

    private val repository: AlbumRepository = mockk()
    private val trackRepository: TrackRepository = mockk()
    private val service = AlbumService(repository, trackRepository)

    private fun album(id: Uuid = Uuid.random()) = Album(
        id = id,
        albumArtist = "Miles Davis",
        album = "Kind of Blue",
        date = "1959",
        genre = "Jazz",
        label = "Columbia",
        catalogNumber = "CL 1355",
        composer = null,
        conductor = null,
        ensemble = null,
        discogsId = null,
        directoryPath = "/music/Kind of Blue",
        extraTags = null,
        images = null,
    )

    @Test
    fun `getAlbum returns album when found`() = runTest {
        val id = Uuid.random()
        val expected = album(id)
        coEvery { repository.findById(id) } returns expected

        val result = service.getAlbum(id)

        assertEquals(expected, result)
        coVerify(exactly = 1) { repository.findById(id) }
    }

    @Test
    fun `getAlbum throws ResourceNotFoundException when not found`() = runTest {
        val id = Uuid.random()
        coEvery { repository.findById(id) } returns null

        assertFailsWith<ResourceNotFoundException> {
            service.getAlbum(id)
        }
    }

    @Test
    fun `listAlbums returns albums and total count from a single transaction`() = runTest {
        val albums = listOf(album(), album())
        coEvery { repository.findAllWithCount(0, 20) } returns (albums to 2L)

        val (result, total) = service.listAlbums(0, 20)

        assertEquals(albums, result)
        assertEquals(2L, total)
        coVerify(exactly = 1) { repository.findAllWithCount(0, 20) }
    }

    @Test
    fun `listAlbums returns empty list when repository is empty`() = runTest {
        coEvery { repository.findAllWithCount(0, 20) } returns (emptyList<Album>() to 0L)

        val (result, total) = service.listAlbums(0, 20)

        assertEquals(emptyList(), result)
        assertEquals(0L, total)
    }

    @Test
    fun `listAlbums delegates to findAllWithCount for a single atomic result`() = runTest {
        val albums = listOf(album())
        coEvery { repository.findAllWithCount(1, 10) } returns (albums to 5L)

        val (result, total) = service.listAlbums(1, 10)

        assertEquals(albums, result)
        assertEquals(5L, total)
        // Verify the single atomic method is used (not two separate calls that could race)
        coVerify(exactly = 1) { repository.findAllWithCount(1, 10) }
    }

    @Test
    fun `getAlbumWithTracks returns album and tracks when album found`() = runTest {
        val albumId = Uuid.random()
        val expectedAlbum = album(albumId)
        val expectedTracks = listOf(track(albumId = albumId))
        coEvery { repository.findById(albumId) } returns expectedAlbum
        coEvery { trackRepository.findByAlbumId(albumId) } returns expectedTracks

        val (resultAlbum, resultTracks) = service.getAlbumWithTracks(albumId)

        assertEquals(expectedAlbum, resultAlbum)
        assertEquals(expectedTracks, resultTracks)
    }

    @Test
    fun `getAlbumWithTracks throws ResourceNotFoundException when album not found`() = runTest {
        val albumId = Uuid.random()
        coEvery { repository.findById(albumId) } returns null

        assertFailsWith<ResourceNotFoundException> {
            service.getAlbumWithTracks(albumId)
        }
    }

    @Test
    fun `getAlbumWithTracks returns empty track list when album has no tracks`() = runTest {
        val albumId = Uuid.random()
        val expectedAlbum = album(albumId)
        coEvery { repository.findById(albumId) } returns expectedAlbum
        coEvery { trackRepository.findByAlbumId(albumId) } returns emptyList()

        val (resultAlbum, resultTracks) = service.getAlbumWithTracks(albumId)

        assertEquals(expectedAlbum, resultAlbum)
        assertEquals(emptyList(), resultTracks)
    }

    private fun track(albumId: Uuid = Uuid.random()) = Track(
        id = Uuid.random(),
        albumId = albumId,
        title = "So What",
        trackNumber = "1",
        discNumber = null,
        trackTotal = null,
        discTotal = null,
        artist = null,
        composer = null,
        conductor = null,
        ensemble = null,
        durationSeconds = 565,
        path = "01 So What.flac",
        images = null,
        extraTags = null,
    )
}
