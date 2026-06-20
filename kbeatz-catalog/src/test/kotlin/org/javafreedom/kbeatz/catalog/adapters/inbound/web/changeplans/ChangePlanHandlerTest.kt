package org.javafreedom.kbeatz.catalog.adapters.inbound.web.changeplans

import io.ktor.client.call.body
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation as ClientContentNegotiation
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.routing.routing
import io.ktor.server.testing.testApplication
import io.mockk.mockk
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.uuid.Uuid
import kotlinx.serialization.json.Json
import org.javafreedom.kbeatz.catalog.api.models.ChangePlan as ApiChangePlan
import org.javafreedom.kbeatz.catalog.api.models.ErrorResponse
import org.javafreedom.kbeatz.catalog.api.models.PlanConflict as ApiPlanConflict
import org.javafreedom.kbeatz.catalog.application.service.ChangePlanApplyService
import org.javafreedom.kbeatz.catalog.application.service.ChangePlanFacade
import org.javafreedom.kbeatz.catalog.application.service.ChangePlanService
import org.javafreedom.kbeatz.catalog.application.service.InMemoryChangePlanStore
import org.javafreedom.kbeatz.catalog.application.service.PlanningFilesystem
import org.javafreedom.kbeatz.catalog.application.service.TagChangeApplier
import org.javafreedom.kbeatz.catalog.infrastructure.move.DirectoryMoveExecutor
import org.javafreedom.kbeatz.catalog.domain.model.Album
import org.javafreedom.kbeatz.catalog.domain.model.DirectoryTemplate
import org.javafreedom.kbeatz.catalog.domain.model.SyncPreview
import org.javafreedom.kbeatz.catalog.domain.model.SyncResult
import org.javafreedom.kbeatz.catalog.domain.port.SyncProvider
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumFilter
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumRepository
import org.javafreedom.kbeatz.catalog.domain.service.DirectoryLayoutPlanner

class ChangePlanHandlerTest {

    private val libraryRoot = "/srv/music"
    private val template = "\${ALBUMARTIST}/\${ALBUM} (\${DATE})"
    private val json = Json { ignoreUnknownKeys = true }

    private class FakeAlbumRepository(albums: List<Album>) : AlbumRepository {
        private val byId = albums.associateBy { it.id }
        override suspend fun findById(id: Uuid): Album? = byId[id]
        override suspend fun findByIds(ids: List<Uuid>): List<Album> = ids.mapNotNull { byId[it] }
        override suspend fun findByDirectoryPath(directoryPath: String): Album? =
            byId.values.firstOrNull { it.directoryPath == directoryPath }
        override suspend fun findAllWithCount(page: Int, size: Int, filter: AlbumFilter) =
            byId.values.toList() to byId.size.toLong()
        override suspend fun save(album: Album): Album = album
        override suspend fun saveAll(albums: List<Album>) = Unit
    }

    private class StubFilesystem(
        private val pathExists: (String) -> Boolean = { true },
        private val lockHeldFn: (String) -> Boolean = { false },
    ) : PlanningFilesystem {
        override fun exists(absolutePath: String): Boolean = pathExists(absolutePath)
        override fun lockHeld(directory: String): Boolean = lockHeldFn(directory)
    }

    private fun album(
        id: Uuid,
        directoryPath: String,
        albumArtist: String = "Miles Davis",
        album: String = "Kind of Blue",
        date: String? = "1959",
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

    // A SyncProvider stub for the create-plan routing tests. preview() returns no proposed changes
    // by default, which is sufficient for the routing assertions here; dedicated DISCOGS_SYNC
    // planning behaviour is covered in ChangePlanFacadeTest.
    private class StubSyncProvider : SyncProvider {
        override val name: String = "stub"
        override suspend fun preview(albumId: Uuid): SyncPreview = SyncPreview(albumId, emptyList())
        override suspend fun sync(albumId: Uuid, downloadImages: Boolean): SyncResult =
            error("not used in routing tests")
    }

    private fun facade(
        albums: List<Album>,
        store: InMemoryChangePlanStore = InMemoryChangePlanStore(),
        pathExists: (String) -> Boolean = { true },
        lockHeld: (String) -> Boolean = { false },
        syncProvider: SyncProvider = StubSyncProvider(),
    ): ChangePlanFacade {
        val service = ChangePlanService(
            albumRepository = FakeAlbumRepository(albums),
            directoryLayoutPlanner = DirectoryLayoutPlanner(DirectoryTemplate(template)),
            libraryRoot = libraryRoot,
            filesystem = StubFilesystem(pathExists, lockHeld),
        )
        return ChangePlanFacade(service, store, syncProvider)
    }

    // These handler tests cover create/get/apply routing; create/get tests never invoke apply, so a
    // throwaway apply service over an unrelated store and mocked executor is sufficient for wiring.
    private fun applyService(store: InMemoryChangePlanStore = InMemoryChangePlanStore()) =
        ChangePlanApplyService(
            store = store,
            directoryMoveExecutor = mockk<DirectoryMoveExecutor>(),
            tagChangeApplier = mockk<TagChangeApplier>(),
        )

    @Test
    fun `should return 201 with consolidated plan for a single album relayout`() = testApplication {
        val id = Uuid.random()
        // Source matches template so no move is planned; the response is still a consolidated plan.
        val targetPath = "/srv/music/Miles Davis/Kind of Blue (1959)"
        val f = facade(listOf(album(id, directoryPath = targetPath)))

        install(ContentNegotiation) { json(json) }
        routing { changePlanRoutes(f, applyService()) }
        val client = createClient { install(ClientContentNegotiation) { json(json) } }

        val response = client.post("/change-plans") {
            contentType(ContentType.Application.Json)
            setBody("""{"operation":"RELAYOUT","albumIds":["$id"]}""")
        }

        assertEquals(HttpStatusCode.Created, response.status)
        val location = response.headers[HttpHeaders.Location]
        assertNotNull(location, "Location header must be present")
        val plan = response.body<ApiChangePlan>()
        assertEquals(1, plan.releases.size)
        assertEquals("RELAYOUT", plan.operation.value)
        assertEquals("/change-plans/${plan.id}", location)
        assertEquals(0, plan.totalMoves)
        assertFalse(plan.hasConflicts)
    }

    @Test
    fun `should return 201 with a single consolidated plan for many albums`() = testApplication {
        val id1 = Uuid.random()
        val id2 = Uuid.random()
        // id1 is already in place; id2 must move to the templated target.
        val placed = "/srv/music/Miles Davis/Kind of Blue (1959)"
        val misplaced = "/srv/music/incoming/coltrane"
        val albums = listOf(
            album(id1, directoryPath = placed),
            album(id2, directoryPath = misplaced, albumArtist = "John Coltrane", album = "Giant Steps", date = "1960"),
        )
        val f = facade(albums)

        install(ContentNegotiation) { json(json) }
        routing { changePlanRoutes(f, applyService()) }
        val client = createClient { install(ClientContentNegotiation) { json(json) } }

        val response = client.post("/change-plans") {
            contentType(ContentType.Application.Json)
            setBody("""{"operation":"RELAYOUT","albumIds":["$id1","$id2"]}""")
        }

        assertEquals(HttpStatusCode.Created, response.status)
        val plan = response.body<ApiChangePlan>()
        assertEquals(2, plan.releases.size)
        assertEquals(1, plan.totalMoves, "Only the misplaced album yields a directory move")
        val moved = plan.releases.first { it.albumId == id2.toString() }
        assertNotNull(moved.directoryMove)
        assertEquals(misplaced, moved.directoryMove?.fromPath)
        assertEquals("/srv/music/John Coltrane/Giant Steps (1960)", moved.directoryMove?.toPath)
    }

    @Test
    fun `should surface conflicts as data not as request failure`() = testApplication {
        val id = Uuid.random()
        val source = "/srv/music/incoming/kob"
        // Source missing on disk -> SOURCE_MISSING conflict, but the request still succeeds with 201.
        val f = facade(listOf(album(id, directoryPath = source)), pathExists = { false })

        install(ContentNegotiation) { json(json) }
        routing { changePlanRoutes(f, applyService()) }
        val client = createClient { install(ClientContentNegotiation) { json(json) } }

        val response = client.post("/change-plans") {
            contentType(ContentType.Application.Json)
            setBody("""{"operation":"RELAYOUT","albumIds":["$id"]}""")
        }

        assertEquals(HttpStatusCode.Created, response.status)
        val plan = response.body<ApiChangePlan>()
        assertTrue(plan.hasConflicts)
        assertEquals(1, plan.totalConflicts)
        val conflict = plan.releases.single().conflicts.single()
        assertEquals(ApiPlanConflict.Type.SOURCE_MISSING, conflict.type)
        assertEquals(id.toString(), conflict.albumId)
    }

    @Test
    fun `should report a missing album as a conflict not a 404`() = testApplication {
        val unknownId = Uuid.random()
        val f = facade(emptyList())

        install(ContentNegotiation) { json(json) }
        routing { changePlanRoutes(f, applyService()) }
        val client = createClient { install(ClientContentNegotiation) { json(json) } }

        val response = client.post("/change-plans") {
            contentType(ContentType.Application.Json)
            setBody("""{"operation":"RELAYOUT","albumIds":["$unknownId"]}""")
        }

        assertEquals(HttpStatusCode.Created, response.status)
        val plan = response.body<ApiChangePlan>()
        assertEquals(ApiPlanConflict.Type.SOURCE_MISSING, plan.releases.single().conflicts.single().type)
    }

    @Test
    fun `should retrieve a stored plan by id`() = testApplication {
        val id = Uuid.random()
        val target = "/srv/music/Miles Davis/Kind of Blue (1959)"
        val store = InMemoryChangePlanStore()
        val f = facade(listOf(album(id, directoryPath = target)), store = store)

        install(ContentNegotiation) { json(json) }
        routing { changePlanRoutes(f, applyService()) }
        val client = createClient { install(ClientContentNegotiation) { json(json) } }

        val created = client.post("/change-plans") {
            contentType(ContentType.Application.Json)
            setBody("""{"operation":"RELAYOUT","albumIds":["$id"]}""")
        }.body<ApiChangePlan>()

        val fetched = client.get("/change-plans/${created.id}")
        assertEquals(HttpStatusCode.OK, fetched.status)
        assertEquals(created.id, fetched.body<ApiChangePlan>().id)
    }

    @Test
    fun `should return 404 for an unknown plan id`() = testApplication {
        val f = facade(emptyList())
        install(ContentNegotiation) { json(json) }
        routing { changePlanRoutes(f, applyService()) }
        val client = createClient { install(ClientContentNegotiation) { json(json) } }

        val response = client.get("/change-plans/${Uuid.random()}")

        assertEquals(HttpStatusCode.NotFound, response.status)
        assertEquals("RESOURCE_NOT_FOUND", response.body<ErrorResponse>().code)
    }

    @Test
    fun `should return 400 for an invalid plan id`() = testApplication {
        val f = facade(emptyList())
        install(ContentNegotiation) { json(json) }
        routing { changePlanRoutes(f, applyService()) }
        val client = createClient { install(ClientContentNegotiation) { json(json) } }

        val response = client.get("/change-plans/not-a-uuid")

        assertEquals(HttpStatusCode.BadRequest, response.status)
        assertEquals("INVALID_PLAN_ID", response.body<ErrorResponse>().code)
    }

    @Test
    fun `should return 422 for RETAG operation`() = testApplication {
        val id = Uuid.random()
        val f = facade(listOf(album(id, directoryPath = "/srv/music/incoming/x")))
        install(ContentNegotiation) { json(json) }
        routing { changePlanRoutes(f, applyService()) }
        val client = createClient { install(ClientContentNegotiation) { json(json) } }

        val response = client.post("/change-plans") {
            contentType(ContentType.Application.Json)
            setBody("""{"operation":"RETAG","albumIds":["$id"]}""")
        }

        assertEquals(HttpStatusCode.UnprocessableEntity, response.status)
        assertEquals("OPERATION_NOT_AVAILABLE", response.body<ErrorResponse>().code)
    }

    @Test
    fun `should return 400 for an invalid album uuid`() = testApplication {
        val f = facade(emptyList())
        install(ContentNegotiation) { json(json) }
        routing { changePlanRoutes(f, applyService()) }
        val client = createClient { install(ClientContentNegotiation) { json(json) } }

        val response = client.post("/change-plans") {
            contentType(ContentType.Application.Json)
            setBody("""{"operation":"RELAYOUT","albumIds":["not-a-uuid"]}""")
        }

        assertEquals(HttpStatusCode.BadRequest, response.status)
        assertEquals("INVALID_ALBUM_ID", response.body<ErrorResponse>().code)
    }

    @Test
    fun `should return 400 for empty albumIds`() = testApplication {
        val f = facade(emptyList())
        install(ContentNegotiation) { json(json) }
        routing { changePlanRoutes(f, applyService()) }
        val client = createClient { install(ClientContentNegotiation) { json(json) } }

        val response = client.post("/change-plans") {
            contentType(ContentType.Application.Json)
            setBody("""{"operation":"RELAYOUT","albumIds":[]}""")
        }

        assertEquals(HttpStatusCode.BadRequest, response.status)
        assertEquals("INVALID_REQUEST", response.body<ErrorResponse>().code)
    }

    @Test
    fun `should return 400 for a malformed request body`() = testApplication {
        val f = facade(emptyList())
        install(ContentNegotiation) { json(json) }
        routing { changePlanRoutes(f, applyService()) }
        val client = createClient { install(ClientContentNegotiation) { json(json) } }

        val response = client.post("/change-plans") {
            contentType(ContentType.Application.Json)
            setBody("""{"operation":"RELAYOUT"}""")
        }

        assertEquals(HttpStatusCode.BadRequest, response.status)
        assertEquals("INVALID_REQUEST", response.body<ErrorResponse>().code)
    }

    @Test
    fun `store returns null for an absent plan id`() {
        assertNull(InMemoryChangePlanStore().get(Uuid.random()))
    }
}
