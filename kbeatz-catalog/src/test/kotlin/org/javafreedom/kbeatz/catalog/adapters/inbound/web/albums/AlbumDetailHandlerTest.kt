package org.javafreedom.kbeatz.catalog.adapters.inbound.web.albums

import io.ktor.client.call.body
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation as ClientContentNegotiation
import io.ktor.client.request.get
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.routing.routing
import io.ktor.server.testing.testApplication
import io.mockk.coEvery
import io.mockk.mockk
import java.nio.file.Path
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.uuid.Uuid
import kotlinx.serialization.json.Json
import org.javafreedom.kbeatz.catalog.api.models.AlbumDetail
import org.javafreedom.kbeatz.catalog.api.models.ErrorResponse
import org.javafreedom.kbeatz.catalog.application.service.AlbumService
import org.javafreedom.kbeatz.catalog.domain.model.Album
import org.javafreedom.kbeatz.catalog.domain.model.Track
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumRepository
import org.javafreedom.kbeatz.catalog.domain.repository.TrackRepository

class AlbumDetailHandlerTest {

    private val albumRepository: AlbumRepository = mockk()
    private val trackRepository: TrackRepository = mockk()
    private val albumService = AlbumService(albumRepository, trackRepository)
    private val libraryRoot = Path.of("/music")

    private val albumId = Uuid.random()

    private fun buildAlbum(id: Uuid = albumId) = Album(
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
        discogsId = "12345",
        directoryPath = "/music/kind-of-blue",
        extraTags = null,
        images = null,
    )

    private fun buildTrack(albumId: Uuid) = Track(
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

    @Test
    fun `GET albums albumId returns 200 with AlbumDetail when found`() = testApplication {
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
        routing { albumDetailRoutes(albumService, libraryRoot) }
        val client = createClient { install(ClientContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

        val track = buildTrack(albumId)
        coEvery { albumRepository.findById(albumId) } returns buildAlbum()
        coEvery { trackRepository.findByAlbumId(albumId) } returns listOf(track)

        val response = client.get("/albums/${albumId}")

        assertEquals(HttpStatusCode.OK, response.status)
        val detail = response.body<AlbumDetail>()
        assertEquals(albumId.toString(), detail.id)
        assertEquals("Miles Davis", detail.albumArtist)
        assertEquals("Kind of Blue", detail.album)
        assertEquals("1959", detail.date)
        assertEquals("Jazz", detail.genre)
        assertEquals(1, detail.tracks.size)
        assertEquals("So What", detail.tracks[0].title)
    }

    @Test
    fun `GET albums albumId returns 200 with empty tracks list when album has no tracks`() = testApplication {
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
        routing { albumDetailRoutes(albumService, libraryRoot) }
        val client = createClient { install(ClientContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

        coEvery { albumRepository.findById(albumId) } returns buildAlbum()
        coEvery { trackRepository.findByAlbumId(albumId) } returns emptyList()

        val response = client.get("/albums/${albumId}")

        assertEquals(HttpStatusCode.OK, response.status)
        val detail = response.body<AlbumDetail>()
        assertEquals(0, detail.tracks.size)
    }

    @Test
    fun `GET albums albumId returns 404 when album not found`() = testApplication {
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
        routing { albumDetailRoutes(albumService, libraryRoot) }
        val client = createClient { install(ClientContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

        coEvery { albumRepository.findById(albumId) } returns null

        val response = client.get("/albums/${albumId}")

        assertEquals(HttpStatusCode.NotFound, response.status)
        val error = response.body<ErrorResponse>()
        assertEquals("RESOURCE_NOT_FOUND", error.code)
    }

    @Test
    fun `GET albums albumId returns 400 when albumId is not a UUID`() = testApplication {
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
        routing { albumDetailRoutes(albumService, libraryRoot) }
        val client = createClient { install(ClientContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

        val response = client.get("/albums/not-a-uuid")

        assertEquals(HttpStatusCode.BadRequest, response.status)
        val error = response.body<ErrorResponse>()
        assertEquals("INVALID_ALBUM_ID", error.code)
    }

    @Test
    fun `GET albums albumId returns relative directoryPath when libraryRoot is configured`() = testApplication {
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
        routing { albumDetailRoutes(albumService, libraryRoot) }
        val client = createClient { install(ClientContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

        coEvery { albumRepository.findById(albumId) } returns buildAlbum()
        coEvery { trackRepository.findByAlbumId(albumId) } returns emptyList()

        val response = client.get("/albums/${albumId}")

        assertEquals(HttpStatusCode.OK, response.status)
        val detail = response.body<AlbumDetail>()
        // domain: /music/kind-of-blue, libraryRoot: /music → relative: kind-of-blue
        assertEquals("kind-of-blue", detail.directoryPath)
    }

    @Test
    fun `GET albums albumId maps all optional fields correctly`() = testApplication {
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
        routing { albumDetailRoutes(albumService, libraryRoot) }
        val client = createClient { install(ClientContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

        val composerAlbum = buildAlbum().copy(
            composer = "Ludwig van Beethoven",
            conductor = "Herbert von Karajan",
            ensemble = "Berlin Philharmoniker",
        )
        coEvery { albumRepository.findById(albumId) } returns composerAlbum
        coEvery { trackRepository.findByAlbumId(albumId) } returns emptyList()

        val response = client.get("/albums/${albumId}")

        assertEquals(HttpStatusCode.OK, response.status)
        val detail = response.body<AlbumDetail>()
        assertNotNull(detail.composer)
        assertEquals("Ludwig van Beethoven", detail.composer)
        assertEquals("Herbert von Karajan", detail.conductor)
        assertEquals("Berlin Philharmoniker", detail.ensemble)
    }
}
