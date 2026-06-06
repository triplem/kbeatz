package org.javafreedom.kbeatz.catalog.adapters.inbound.web.albums

import io.ktor.client.call.body
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation as ClientContentNegotiation
import io.ktor.client.request.patch
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.routing.routing
import io.ktor.server.testing.testApplication
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.uuid.Uuid
import kotlinx.serialization.json.Json
import org.javafreedom.kbeatz.catalog.api.models.AlbumDetail
import org.javafreedom.kbeatz.catalog.api.models.ErrorResponse
import org.javafreedom.kbeatz.catalog.api.models.UpdateTagFieldRequest
import org.javafreedom.kbeatz.catalog.application.service.AlbumService
import org.javafreedom.kbeatz.catalog.application.service.TagWriteService
import org.javafreedom.kbeatz.catalog.domain.model.Album
import org.javafreedom.kbeatz.catalog.domain.model.Track
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumRepository
import org.javafreedom.kbeatz.catalog.domain.repository.TrackRepository
import org.javafreedom.kbeatz.common.ResourceNotFoundException

class TagHandlerTest {

    private val albumRepository: AlbumRepository = mockk()
    private val trackRepository: TrackRepository = mockk()
    private val tagWriteService: TagWriteService = mockk()
    private val albumService = AlbumService(albumRepository, trackRepository)

    private val albumId = Uuid.random()
    private val trackId = Uuid.random()

    private fun buildAlbum(id: Uuid = albumId, genre: String? = "Jazz") = Album(
        id = id,
        albumArtist = "Miles Davis",
        album = "Kind of Blue",
        date = "1959",
        genre = genre,
        label = null,
        catalogNumber = null,
        composer = null,
        conductor = null,
        ensemble = null,
        discogsId = null,
        directoryPath = "/music/kind-of-blue",
        extraTags = null,
        images = null,
    )

    private fun buildTrack() = Track(
        id = trackId,
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

    private fun testApp(block: suspend io.ktor.client.HttpClient.() -> Unit) = testApplication {
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
        routing { tagRoutes(albumService, tagWriteService) }
        val client = createClient { install(ClientContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }
        client.block()
    }

    // ──────────────────────────────────────────────
    // PATCH /albums/{albumId}
    // ──────────────────────────────────────────────

    @Test
    fun `PATCH albums albumId returns 200 with updated AlbumDetail on success`() = testApp {
        val updatedAlbum = buildAlbum(genre = "Progressive Rock")
        coEvery { tagWriteService.writeAlbumTags(albumId, "GENRE", "Progressive Rock") } returns updatedAlbum
        coEvery { albumRepository.findById(albumId) } returns updatedAlbum
        coEvery { trackRepository.findByAlbumId(albumId) } returns listOf(buildTrack())

        val response = patch("/albums/$albumId") {
            contentType(ContentType.Application.Json)
            setBody(UpdateTagFieldRequest(field = "GENRE", value = "Progressive Rock"))
        }

        assertEquals(HttpStatusCode.OK, response.status)
        val detail = response.body<AlbumDetail>()
        assertEquals(albumId.toString(), detail.id)
        assertEquals("Progressive Rock", detail.genre)
        assertEquals(1, detail.tracks.size)
    }

    @Test
    fun `PATCH albums albumId returns 400 when albumId is invalid UUID`() = testApp {
        val response = patch("/albums/not-a-uuid") {
            contentType(ContentType.Application.Json)
            setBody(UpdateTagFieldRequest(field = "GENRE", value = "Rock"))
        }

        assertEquals(HttpStatusCode.BadRequest, response.status)
        val error = response.body<ErrorResponse>()
        assertEquals("INVALID_ALBUM_ID", error.code)
    }

    @Test
    fun `PATCH albums albumId returns 404 when album not found`() = testApp {
        coEvery {
            tagWriteService.writeAlbumTags(albumId, "GENRE", "Rock")
        } throws ResourceNotFoundException("Album", albumId.toString())

        val response = patch("/albums/$albumId") {
            contentType(ContentType.Application.Json)
            setBody(UpdateTagFieldRequest(field = "GENRE", value = "Rock"))
        }

        assertEquals(HttpStatusCode.NotFound, response.status)
        val error = response.body<ErrorResponse>()
        assertEquals("RESOURCE_NOT_FOUND", error.code)
    }

    @Test
    fun `PATCH albums albumId returns 400 when field is invalid`() = testApp {
        coEvery {
            tagWriteService.writeAlbumTags(albumId, "INVALID_FIELD", "value")
        } throws IllegalArgumentException("Unknown album-level tag field: 'INVALID_FIELD'")

        val response = patch("/albums/$albumId") {
            contentType(ContentType.Application.Json)
            setBody(UpdateTagFieldRequest(field = "INVALID_FIELD", value = "value"))
        }

        assertEquals(HttpStatusCode.BadRequest, response.status)
        val error = response.body<ErrorResponse>()
        assertEquals("INVALID_FIELD", error.code)
    }

    @Test
    fun `PATCH albums albumId delegates to tagWriteService with correct parameters`() = testApp {
        val updatedAlbum = buildAlbum()
        coEvery { tagWriteService.writeAlbumTags(albumId, "GENRE", "Rock") } returns updatedAlbum
        coEvery { albumRepository.findById(albumId) } returns updatedAlbum
        coEvery { trackRepository.findByAlbumId(albumId) } returns emptyList()

        patch("/albums/$albumId") {
            contentType(ContentType.Application.Json)
            setBody(UpdateTagFieldRequest(field = "GENRE", value = "Rock"))
        }

        coVerify(exactly = 1) { tagWriteService.writeAlbumTags(albumId, "GENRE", "Rock") }
    }

    // ──────────────────────────────────────────────
    // PATCH /albums/{albumId}/tracks/{trackId}
    // ──────────────────────────────────────────────

    @Test
    fun `PATCH albums albumId tracks trackId returns 200 with updated AlbumDetail on success`() = testApp {
        val updatedTrack = buildTrack().copy(title = "New Title")
        coEvery { tagWriteService.writeTrackTags(albumId, trackId, "TITLE", "New Title") } returns updatedTrack
        coEvery { albumRepository.findById(albumId) } returns buildAlbum()
        coEvery { trackRepository.findByAlbumId(albumId) } returns listOf(updatedTrack)

        val response = patch("/albums/$albumId/tracks/$trackId") {
            contentType(ContentType.Application.Json)
            setBody(UpdateTagFieldRequest(field = "TITLE", value = "New Title"))
        }

        assertEquals(HttpStatusCode.OK, response.status)
        val detail = response.body<AlbumDetail>()
        assertEquals("New Title", detail.tracks[0].title)
    }

    @Test
    fun `PATCH albums albumId tracks trackId returns 400 when trackId is invalid`() = testApp {
        val response = patch("/albums/$albumId/tracks/not-a-uuid") {
            contentType(ContentType.Application.Json)
            setBody(UpdateTagFieldRequest(field = "TITLE", value = "Title"))
        }

        assertEquals(HttpStatusCode.BadRequest, response.status)
        val error = response.body<ErrorResponse>()
        assertEquals("INVALID_TRACK_ID", error.code)
    }

    @Test
    fun `PATCH albums albumId tracks trackId returns 404 when track not found`() = testApp {
        coEvery {
            tagWriteService.writeTrackTags(albumId, trackId, "TITLE", "New Title")
        } throws ResourceNotFoundException("Track", trackId.toString())

        val response = patch("/albums/$albumId/tracks/$trackId") {
            contentType(ContentType.Application.Json)
            setBody(UpdateTagFieldRequest(field = "TITLE", value = "New Title"))
        }

        assertEquals(HttpStatusCode.NotFound, response.status)
        val error = response.body<ErrorResponse>()
        assertEquals("RESOURCE_NOT_FOUND", error.code)
    }

    @Test
    fun `PATCH albums albumId tracks trackId returns 400 when field is invalid`() = testApp {
        coEvery {
            tagWriteService.writeTrackTags(albumId, trackId, "GENRE", "Jazz")
        } throws IllegalArgumentException("Unknown track-level tag field: 'GENRE'")

        val response = patch("/albums/$albumId/tracks/$trackId") {
            contentType(ContentType.Application.Json)
            setBody(UpdateTagFieldRequest(field = "GENRE", value = "Jazz"))
        }

        assertEquals(HttpStatusCode.BadRequest, response.status)
        val error = response.body<ErrorResponse>()
        assertEquals("INVALID_FIELD", error.code)
    }
}
