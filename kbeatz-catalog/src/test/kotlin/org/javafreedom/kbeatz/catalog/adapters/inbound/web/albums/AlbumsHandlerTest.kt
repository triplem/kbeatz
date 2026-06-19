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
import io.mockk.coVerify
import io.mockk.mockk
import java.nio.file.Path
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.uuid.Uuid
import kotlinx.serialization.json.Json
import org.javafreedom.kbeatz.catalog.api.models.AlbumPage
import org.javafreedom.kbeatz.catalog.application.service.AlbumService
import org.javafreedom.kbeatz.catalog.domain.model.Album
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumFilter
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumRepository
import org.javafreedom.kbeatz.catalog.domain.repository.TrackRepository

class AlbumsHandlerTest {

    private val albumRepository: AlbumRepository = mockk()
    private val trackRepository: TrackRepository = mockk()
    private val albumService = AlbumService(albumRepository, trackRepository)
    private val libraryRoot = Path.of("/music")

    private fun buildAlbum(
        id: Uuid = Uuid.random(),
        albumArtist: String = "Miles Davis",
        genre: String? = "Jazz",
        composer: String? = null,
        country: String? = null,
        mediaFormat: String? = null,
    ) = Album(
        id = id,
        albumArtist = albumArtist,
        album = "Kind of Blue",
        date = "1959",
        genre = genre,
        label = "Columbia",
        catalogNumber = null,
        composer = composer,
        conductor = null,
        ensemble = null,
        country = country,
        mediaFormat = mediaFormat,
        discogsId = null,
        directoryPath = "/music/kind-of-blue",
        extraTags = null,
        images = null,
    )

    @Test
    fun `GET albums without filters returns page 0 with default size`() = testApplication {
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
        routing { albumRoutes(albumService, libraryRoot) }
        val client = createClient { install(ClientContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

        val albums = listOf(buildAlbum())
        coEvery { albumRepository.findAllWithCount(0, 20, AlbumFilter()) } returns (albums to 1L)

        val response = client.get("/albums")

        assertEquals(HttpStatusCode.OK, response.status)
        val page = response.body<AlbumPage>()
        assertEquals(0, page.page)
        assertEquals(1, page.content.size)
        assertEquals(1L, page.totalElements)
        assertEquals(1, page.totalPages)
    }

    @Test
    fun `GET albums with q param passes free-text filter to repository`() = testApplication {
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
        routing { albumRoutes(albumService, libraryRoot) }
        val client = createClient { install(ClientContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

        val albums = listOf(buildAlbum())
        coEvery {
            albumRepository.findAllWithCount(0, 20, AlbumFilter(q = "miles"))
        } returns (albums to 1L)

        val response = client.get("/albums?q=miles")

        assertEquals(HttpStatusCode.OK, response.status)
        coVerify(exactly = 1) { albumRepository.findAllWithCount(0, 20, AlbumFilter(q = "miles")) }
    }

    @Test
    fun `GET albums with albumArtist param passes artist filter to repository`() = testApplication {
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
        routing { albumRoutes(albumService, libraryRoot) }
        val client = createClient { install(ClientContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

        val albums = listOf(buildAlbum())
        coEvery {
            albumRepository.findAllWithCount(0, 20, AlbumFilter(albumArtist = "Davis"))
        } returns (albums to 1L)

        val response = client.get("/albums?albumArtist=Davis")

        assertEquals(HttpStatusCode.OK, response.status)
        coVerify(exactly = 1) { albumRepository.findAllWithCount(0, 20, AlbumFilter(albumArtist = "Davis")) }
    }

    @Test
    fun `GET albums with genre param passes genre filter to repository`() = testApplication {
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
        routing { albumRoutes(albumService, libraryRoot) }
        val client = createClient { install(ClientContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

        val albums = listOf(buildAlbum(genre = "Jazz"))
        coEvery {
            albumRepository.findAllWithCount(0, 20, AlbumFilter(genre = "Jazz"))
        } returns (albums to 1L)

        val response = client.get("/albums?genre=Jazz")

        assertEquals(HttpStatusCode.OK, response.status)
        coVerify(exactly = 1) { albumRepository.findAllWithCount(0, 20, AlbumFilter(genre = "Jazz")) }
    }

    @Test
    fun `GET albums with yearFrom and yearTo passes year range filter to repository`() = testApplication {
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
        routing { albumRoutes(albumService, libraryRoot) }
        val client = createClient { install(ClientContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

        val albums = listOf(buildAlbum())
        coEvery {
            albumRepository.findAllWithCount(0, 20, AlbumFilter(yearFrom = 1950, yearTo = 1960))
        } returns (albums to 1L)

        val response = client.get("/albums?yearFrom=1950&yearTo=1960")

        assertEquals(HttpStatusCode.OK, response.status)
        coVerify(exactly = 1) {
            albumRepository.findAllWithCount(0, 20, AlbumFilter(yearFrom = 1950, yearTo = 1960))
        }
    }

    @Test
    fun `GET albums with page and size overrides defaults`() = testApplication {
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
        routing { albumRoutes(albumService, libraryRoot) }
        val client = createClient { install(ClientContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

        coEvery {
            albumRepository.findAllWithCount(2, 10, AlbumFilter())
        } returns (emptyList<Album>() to 25L)

        val response = client.get("/albums?page=2&size=10")

        assertEquals(HttpStatusCode.OK, response.status)
        val page = response.body<AlbumPage>()
        assertEquals(2, page.page)
        assertEquals(10, page.propertySize)
        assertEquals(25L, page.totalElements)
        assertEquals(3, page.totalPages)
    }

    @Test
    fun `GET albums returns totalPages 0 when library is empty`() = testApplication {
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
        routing { albumRoutes(albumService, libraryRoot) }
        val client = createClient { install(ClientContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

        coEvery {
            albumRepository.findAllWithCount(0, 20, AlbumFilter())
        } returns (emptyList<Album>() to 0L)

        val response = client.get("/albums")

        assertEquals(HttpStatusCode.OK, response.status)
        val page = response.body<AlbumPage>()
        assertEquals(0, page.totalPages)
        assertEquals(0L, page.totalElements)
    }

    @Test
    fun `GET albums blank q param is treated as no filter`() = testApplication {
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
        routing { albumRoutes(albumService, libraryRoot) }
        val client = createClient { install(ClientContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

        coEvery {
            albumRepository.findAllWithCount(0, 20, AlbumFilter())
        } returns (emptyList<Album>() to 0L)

        val response = client.get("/albums?q=")

        assertEquals(HttpStatusCode.OK, response.status)
        // blank q should be stripped to null - same as no filter
        coVerify(exactly = 1) { albumRepository.findAllWithCount(0, 20, AlbumFilter()) }
    }

    @Test
    fun `GET albums returns albumPath populated and relative in each album`() = testApplication {
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
        routing { albumRoutes(albumService, libraryRoot) }
        val client = createClient { install(ClientContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

        val albums = listOf(buildAlbum())
        coEvery { albumRepository.findAllWithCount(0, 20, AlbumFilter()) } returns (albums to 1L)

        val response = client.get("/albums")

        assertEquals(HttpStatusCode.OK, response.status)
        val page = response.body<AlbumPage>()
        val first = page.content.first()
        assertNotNull(first.albumPath)
        assertFalse(first.albumPath!!.isBlank(), "albumPath must not be blank")
        assertFalse(first.albumPath!!.startsWith("/"), "albumPath must be relative, not absolute")
        assertEquals("kind-of-blue", first.albumPath)
    }

    // --- country field tests (issue #899) ---

    @Test
    fun `GET albums returns country when COUNTRY tag is present`() = testApplication {
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
        routing { albumRoutes(albumService, libraryRoot) }
        val client = createClient { install(ClientContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

        val albums = listOf(buildAlbum(country = "USA"))
        coEvery { albumRepository.findAllWithCount(0, 20, AlbumFilter()) } returns (albums to 1L)

        val response = client.get("/albums")

        assertEquals(HttpStatusCode.OK, response.status)
        val page = response.body<AlbumPage>()
        assertEquals("USA", page.content.first().country)
    }

    @Test
    fun `GET albums returns null country when COUNTRY tag is absent`() = testApplication {
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
        routing { albumRoutes(albumService, libraryRoot) }
        val client = createClient { install(ClientContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

        val albums = listOf(buildAlbum())
        coEvery { albumRepository.findAllWithCount(0, 20, AlbumFilter()) } returns (albums to 1L)

        val response = client.get("/albums")

        assertEquals(HttpStatusCode.OK, response.status)
        val page = response.body<AlbumPage>()
        assertEquals(null, page.content.first().country, "country must be null when COUNTRY tag is absent")
    }

    // --- mediaFormat field tests (issue #899) ---

    @Test
    fun `GET albums returns mediaFormat when MEDIA tag is present`() = testApplication {
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
        routing { albumRoutes(albumService, libraryRoot) }
        val client = createClient { install(ClientContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

        val albums = listOf(buildAlbum(mediaFormat = "2 x Vinyl, LP, Album"))
        coEvery { albumRepository.findAllWithCount(0, 20, AlbumFilter()) } returns (albums to 1L)

        val response = client.get("/albums")

        assertEquals(HttpStatusCode.OK, response.status)
        val page = response.body<AlbumPage>()
        assertEquals("2 x Vinyl, LP, Album", page.content.first().mediaFormat)
    }

    @Test
    fun `GET albums returns null mediaFormat when MEDIA tag is absent`() = testApplication {
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
        routing { albumRoutes(albumService, libraryRoot) }
        val client = createClient { install(ClientContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

        val albums = listOf(buildAlbum())
        coEvery { albumRepository.findAllWithCount(0, 20, AlbumFilter()) } returns (albums to 1L)

        val response = client.get("/albums")

        assertEquals(HttpStatusCode.OK, response.status)
        val page = response.body<AlbumPage>()
        assertEquals(null, page.content.first().mediaFormat, "mediaFormat must be null when MEDIA tag is absent")
    }
}
