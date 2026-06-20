package org.javafreedom.kbeatz.catalog.adapters.inbound.web.settings

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
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.uuid.Uuid
import kotlinx.serialization.json.Json
import org.javafreedom.kbeatz.catalog.api.models.ErrorResponse
import org.javafreedom.kbeatz.catalog.api.models.LayoutPreview
import org.javafreedom.kbeatz.catalog.api.models.LayoutSettings
import org.javafreedom.kbeatz.catalog.domain.model.Album
import org.javafreedom.kbeatz.catalog.domain.model.DirectoryTemplate
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumRepository
import org.javafreedom.kbeatz.catalog.domain.service.DirectoryLayoutPlanner

class SettingsHandlerTest {

    private val albumRepository: AlbumRepository = mockk()
    private val libraryRoot = Path.of("/music")
    private val template = "\${ALBUMARTIST}/\${ALBUM} (\${DATE})"
    private val planner = DirectoryLayoutPlanner(DirectoryTemplate(template))

    private fun buildAlbum(
        id: Uuid = Uuid.random(),
        albumArtist: String = "Miles Davis",
        album: String = "Kind of Blue",
        date: String? = "1959",
        directoryPath: String = "/music/incoming/kind-of-blue",
    ) = Album(
        id = id,
        albumArtist = albumArtist,
        album = album,
        date = date,
        genre = "Jazz",
        label = "Columbia",
        catalogNumber = null,
        composer = null,
        conductor = null,
        ensemble = null,
        discogsId = null,
        directoryPath = directoryPath,
        extraTags = null,
        images = null,
    )

    @Test
    fun `GET settings layout returns the active template and supported tokens`() = testApplication {
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
        routing { settingsRoutes(albumRepository, planner, template, libraryRoot) }
        val client = createClient { install(ClientContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

        val response = client.get("/settings/layout")

        assertEquals(HttpStatusCode.OK, response.status)
        val body = response.body<LayoutSettings>()
        assertEquals(template, body.directoryTemplate)
        assertEquals(DirectoryTemplate.SUPPORTED_TOKENS.sorted(), body.supportedTokens)
        assertTrue(body.supportedTokens.contains("ALBUMARTIST"))
    }

    @Test
    fun `GET layout preview returns current and planned directory for an album`() = testApplication {
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
        routing { settingsRoutes(albumRepository, planner, template, libraryRoot) }
        val client = createClient { install(ClientContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

        val id = Uuid.random()
        coEvery { albumRepository.findById(id) } returns buildAlbum(id = id)

        val response = client.get("/settings/layout/preview/$id")

        assertEquals(HttpStatusCode.OK, response.status)
        val body = response.body<LayoutPreview>()
        assertEquals(id.toString(), body.albumId)
        assertEquals("incoming/kind-of-blue", body.currentDirectory)
        assertEquals("Miles Davis/Kind of Blue (1959)", body.plannedDirectory)
        assertTrue(body.withinLibraryRoot)
        assertNull(body.message)
    }

    @Test
    fun `GET layout preview reports already in place when planned equals current`() = testApplication {
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
        routing { settingsRoutes(albumRepository, planner, template, libraryRoot) }
        val client = createClient { install(ClientContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

        val id = Uuid.random()
        coEvery { albumRepository.findById(id) } returns
            buildAlbum(id = id, directoryPath = "/music/Miles Davis/Kind of Blue (1959)")

        val response = client.get("/settings/layout/preview/$id")

        assertEquals(HttpStatusCode.OK, response.status)
        val body = response.body<LayoutPreview>()
        assertEquals(body.currentDirectory, body.plannedDirectory)
        assertTrue(body.withinLibraryRoot)
    }

    @Test
    fun `GET layout preview reports traversal rejection as data with 200`() = testApplication {
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
        // A planner whose root differs from the album path can still resolve safely, so to force
        // the guard we use an album whose rendered path is empty, which the planner allows. Instead,
        // simulate rejection by using a planner that always escapes: a root pointing elsewhere is not
        // enough, so we mock the planner to throw.
        val rejectingPlanner: DirectoryLayoutPlanner = mockk()
        val id = Uuid.random()
        io.mockk.every { rejectingPlanner.planTargetDirectory(any(), any()) } throws
            SecurityException("escapes the library root")
        routing { settingsRoutes(albumRepository, rejectingPlanner, template, libraryRoot) }
        val client = createClient { install(ClientContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

        coEvery { albumRepository.findById(id) } returns buildAlbum(id = id)

        val response = client.get("/settings/layout/preview/$id")

        assertEquals(HttpStatusCode.OK, response.status)
        val body = response.body<LayoutPreview>()
        assertNull(body.plannedDirectory)
        assertFalse(body.withinLibraryRoot)
        assertEquals("Planned directory would escape the library root", body.message)
    }

    @Test
    fun `GET layout preview returns 404 when album is not found`() = testApplication {
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
        routing { settingsRoutes(albumRepository, planner, template, libraryRoot) }
        val client = createClient { install(ClientContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

        val id = Uuid.random()
        coEvery { albumRepository.findById(id) } returns null

        val response = client.get("/settings/layout/preview/$id")

        assertEquals(HttpStatusCode.NotFound, response.status)
        val body = response.body<ErrorResponse>()
        assertEquals("RESOURCE_NOT_FOUND", body.code)
    }

    @Test
    fun `GET layout preview returns 400 for an invalid album id`() = testApplication {
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
        routing { settingsRoutes(albumRepository, planner, template, libraryRoot) }
        val client = createClient { install(ClientContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

        val response = client.get("/settings/layout/preview/not-a-uuid")

        assertEquals(HttpStatusCode.BadRequest, response.status)
        val body = response.body<ErrorResponse>()
        assertEquals("INVALID_ALBUM_ID", body.code)
    }
}
