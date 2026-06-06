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
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumRepository
import org.javafreedom.kbeatz.common.ResourceNotFoundException

class AlbumServiceTest {

    private val repository: AlbumRepository = mockk()
    private val service = AlbumService(repository)

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
    fun `listAlbums returns albums and total count`() = runTest {
        val albums = listOf(album(), album())
        coEvery { repository.findAll(0, 20) } returns albums
        coEvery { repository.count() } returns 2L

        val (result, total) = service.listAlbums(0, 20)

        assertEquals(albums, result)
        assertEquals(2L, total)
    }

    @Test
    fun `listAlbums returns empty list when repository is empty`() = runTest {
        coEvery { repository.findAll(0, 20) } returns emptyList()
        coEvery { repository.count() } returns 0L

        val (result, total) = service.listAlbums(0, 20)

        assertEquals(emptyList(), result)
        assertEquals(0L, total)
    }
}
