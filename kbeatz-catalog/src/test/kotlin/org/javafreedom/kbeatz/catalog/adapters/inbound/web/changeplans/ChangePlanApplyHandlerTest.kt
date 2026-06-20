package org.javafreedom.kbeatz.catalog.adapters.inbound.web.changeplans

import io.ktor.client.call.body
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation as ClientContentNegotiation
import io.ktor.client.request.post
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.routing.routing
import io.ktor.server.testing.testApplication
import io.mockk.mockk
import java.nio.file.Files
import java.nio.file.Path
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import kotlin.time.Clock
import kotlin.uuid.Uuid
import kotlinx.serialization.json.Json
import org.javafreedom.kbeatz.catalog.api.models.ApplyChangePlanResult as ApiApplyChangePlanResult
import org.javafreedom.kbeatz.catalog.api.models.ErrorResponse
import org.javafreedom.kbeatz.catalog.api.models.ReleaseApplyOutcome as ApiReleaseApplyOutcome
import org.javafreedom.kbeatz.catalog.application.service.ChangePlanApplyService
import org.javafreedom.kbeatz.catalog.application.service.ChangePlanFacade
import org.javafreedom.kbeatz.catalog.application.service.InMemoryChangePlanStore
import org.javafreedom.kbeatz.catalog.application.service.TagChangeApplier
import org.javafreedom.kbeatz.catalog.domain.model.Album
import org.javafreedom.kbeatz.catalog.domain.model.ChangeOperation
import org.javafreedom.kbeatz.catalog.domain.model.ChangePlan
import org.javafreedom.kbeatz.catalog.domain.model.ConflictType
import org.javafreedom.kbeatz.catalog.domain.model.DirectoryMove
import org.javafreedom.kbeatz.catalog.domain.model.PlanConflict
import org.javafreedom.kbeatz.catalog.domain.model.ReleaseChangeSet
import org.javafreedom.kbeatz.catalog.infrastructure.move.DirectoryMoveExecutor
import org.javafreedom.kbeatz.catalog.infrastructure.move.MutableAlbumRepository
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir

/**
 * Integration tests for `POST /change-plans/{planId}/apply` (story #816).
 *
 * Uses a real temp filesystem (@TempDir), the real [DirectoryMoveExecutor], and an in-memory
 * [MutableAlbumRepository] so directories are actually moved on disk and the album row is updated.
 */
class ChangePlanApplyHandlerTest {

    private val json = Json { ignoreUnknownKeys = true }

    private fun album(id: Uuid, directoryPath: String) = Album(
        id = id,
        albumArtist = "Miles Davis",
        album = "Kind of Blue",
        date = "1959",
        genre = "Jazz",
        label = null,
        catalogNumber = null,
        composer = null,
        conductor = null,
        ensemble = null,
        discogsId = null,
        directoryPath = directoryPath,
        extraTags = null,
        images = null,
    )

    private fun writeFlac(dir: Path, name: String) {
        Files.createDirectories(dir)
        Files.writeString(dir.resolve(name), "flac-bytes-$name")
    }

    private fun relayoutPlan(vararg releases: ReleaseChangeSet) = ChangePlan(
        id = Uuid.random(),
        operation = ChangeOperation.RELAYOUT,
        releases = releases.toList(),
        createdAt = Clock.System.now(),
    )

    private fun wireRoutes(
        repo: MutableAlbumRepository,
        root: Path,
        store: InMemoryChangePlanStore,
    ): ChangePlanApplyService {
        val executor = DirectoryMoveExecutor(repo, root, root.resolve(".data"))
        return ChangePlanApplyService(store, executor, mockk<TagChangeApplier>())
    }

    private fun facadeFor(applyService: ChangePlanApplyService): ChangePlanFacade = mockk(relaxed = true)

    @Test
    fun `should apply a relayout move and return 200 with APPLIED outcome`(@TempDir root: Path) = testApplication {
        val albumId = Uuid.random()
        val from = root.resolve("incoming/kob")
        val to = root.resolve("Miles Davis/Kind of Blue (1959)")
        writeFlac(from, "01.flac")
        val repo = MutableAlbumRepository(album(albumId, from.toString()))
        val store = InMemoryChangePlanStore()
        val plan = relayoutPlan(
            ReleaseChangeSet(albumId, DirectoryMove(albumId, from.toString(), to.toString()), emptyList(), emptyList()),
        )
        store.put(plan)
        val applyService = wireRoutes(repo, root, store)

        install(ContentNegotiation) { json(json) }
        routing { changePlanRoutes(facadeFor(applyService), applyService) }
        val client = createClient { install(ClientContentNegotiation) { json(json) } }

        val response = client.post("/change-plans/${plan.id}/apply")

        assertEquals(HttpStatusCode.OK, response.status)
        val result = response.body<ApiApplyChangePlanResult>()
        assertEquals(plan.id.toString(), result.planId)
        assertEquals(1, result.appliedCount)
        assertEquals(0, result.skippedCount)
        assertEquals(0, result.failedCount)
        assertEquals(ApiReleaseApplyOutcome.APPLIED, result.releases.single().outcome)
        assertFalse(Files.exists(from), "source directory must be gone after move")
        assertTrue(Files.exists(to.resolve("01.flac")), "target must contain the moved file")
        assertEquals(to.toString(), repo.find(albumId)?.directoryPath)
    }

    @Test
    fun `should skip a release that carries conflicts without touching disk`(@TempDir root: Path) = testApplication {
        val albumId = Uuid.random()
        val from = root.resolve("incoming/kob")
        writeFlac(from, "01.flac")
        val repo = MutableAlbumRepository(album(albumId, from.toString()))
        val store = InMemoryChangePlanStore()
        val conflict = PlanConflict(ConflictType.TARGET_EXISTS, albumId, from.toString(), "target exists")
        val plan = relayoutPlan(
            ReleaseChangeSet(
                albumId,
                DirectoryMove(albumId, from.toString(), root.resolve("x").toString()),
                emptyList(),
                listOf(conflict),
            ),
        )
        store.put(plan)
        val applyService = wireRoutes(repo, root, store)

        install(ContentNegotiation) { json(json) }
        routing { changePlanRoutes(facadeFor(applyService), applyService) }
        val client = createClient { install(ClientContentNegotiation) { json(json) } }

        val response = client.post("/change-plans/${plan.id}/apply")

        assertEquals(HttpStatusCode.OK, response.status)
        val result = response.body<ApiApplyChangePlanResult>()
        assertEquals(0, result.appliedCount)
        assertEquals(1, result.skippedCount)
        assertEquals(ApiReleaseApplyOutcome.SKIPPED, result.releases.single().outcome)
        assertTrue(Files.exists(from.resolve("01.flac")), "skipped release must leave the source untouched")
        assertEquals(from.toString(), repo.find(albumId)?.directoryPath)
    }

    @Test
    fun `should continue the batch when one release fails and apply the others`(@TempDir root: Path) = testApplication {
        val okId = Uuid.random()
        val failId = Uuid.random()
        val okFrom = root.resolve("incoming/ok")
        val okTo = root.resolve("sorted/ok")
        val failFrom = root.resolve("incoming/fail")
        val failTo = root.resolve("sorted/fail")
        writeFlac(okFrom, "01.flac")
        writeFlac(failFrom, "01.flac")
        // Pre-create the failing target so the executor raises a ConflictException for that release.
        writeFlac(failTo, "existing.flac")
        val repo = MutableAlbumRepository(album(okId, okFrom.toString()), album(failId, failFrom.toString()))
        val store = InMemoryChangePlanStore()
        val plan = relayoutPlan(
            ReleaseChangeSet(okId, DirectoryMove(okId, okFrom.toString(), okTo.toString()), emptyList(), emptyList()),
            ReleaseChangeSet(
                failId,
                DirectoryMove(failId, failFrom.toString(), failTo.toString()),
                emptyList(),
                emptyList(),
            ),
        )
        store.put(plan)
        val applyService = wireRoutes(repo, root, store)

        install(ContentNegotiation) { json(json) }
        routing { changePlanRoutes(facadeFor(applyService), applyService) }
        val client = createClient { install(ClientContentNegotiation) { json(json) } }

        val response = client.post("/change-plans/${plan.id}/apply")

        assertEquals(HttpStatusCode.OK, response.status)
        val result = response.body<ApiApplyChangePlanResult>()
        assertEquals(1, result.appliedCount)
        assertEquals(1, result.failedCount)
        assertEquals(0, result.skippedCount)
        val okResult = result.releases.single { it.albumId == okId.toString() }
        val failResult = result.releases.single { it.albumId == failId.toString() }
        assertEquals(ApiReleaseApplyOutcome.APPLIED, okResult.outcome)
        assertEquals(ApiReleaseApplyOutcome.FAILED, failResult.outcome)
        // The successful release was applied even though the other one failed (batch not aborted).
        assertTrue(Files.exists(okTo.resolve("01.flac")), "successful release must be moved")
        assertEquals(okTo.toString(), repo.find(okId)?.directoryPath)
        // The failing release is left untouched (no half-applied state).
        assertTrue(Files.exists(failFrom.resolve("01.flac")), "failed release source must remain")
    }

    @Test
    fun `should be an idempotent no-op when the same plan is applied twice`(@TempDir root: Path) = testApplication {
        val albumId = Uuid.random()
        val from = root.resolve("incoming/kob")
        val to = root.resolve("sorted/kob")
        writeFlac(from, "01.flac")
        val repo = MutableAlbumRepository(album(albumId, from.toString()))
        val store = InMemoryChangePlanStore()
        val plan = relayoutPlan(
            ReleaseChangeSet(albumId, DirectoryMove(albumId, from.toString(), to.toString()), emptyList(), emptyList()),
        )
        store.put(plan)
        val applyService = wireRoutes(repo, root, store)

        install(ContentNegotiation) { json(json) }
        routing { changePlanRoutes(facadeFor(applyService), applyService) }
        val client = createClient { install(ClientContentNegotiation) { json(json) } }

        val first = client.post("/change-plans/${plan.id}/apply")
        assertEquals(HttpStatusCode.OK, first.status)
        assertEquals(1, first.body<ApiApplyChangePlanResult>().appliedCount)

        // Re-apply: the move already happened, so the executor reconciles to a no-op and reports APPLIED.
        val second = client.post("/change-plans/${plan.id}/apply")
        assertEquals(HttpStatusCode.OK, second.status)
        val result = second.body<ApiApplyChangePlanResult>()
        assertEquals(1, result.appliedCount)
        assertEquals(0, result.failedCount)
        assertEquals(ApiReleaseApplyOutcome.APPLIED, result.releases.single().outcome)
        assertEquals(to.toString(), repo.find(albumId)?.directoryPath, "DB remains stable after re-apply")
    }

    @Test
    fun `should return 404 for an unknown plan id`(@TempDir root: Path) = testApplication {
        val repo = MutableAlbumRepository()
        val store = InMemoryChangePlanStore()
        val applyService = wireRoutes(repo, root, store)

        install(ContentNegotiation) { json(json) }
        routing { changePlanRoutes(facadeFor(applyService), applyService) }
        val client = createClient { install(ClientContentNegotiation) { json(json) } }

        val response = client.post("/change-plans/${Uuid.random()}/apply")

        assertEquals(HttpStatusCode.NotFound, response.status)
        val error = response.body<ErrorResponse>()
        assertEquals("RESOURCE_NOT_FOUND", error.code)
        assertTrue(error.message.contains("not found or expired"), "404 must guide the caller to recover")
        assertTrue(error.message.contains("POST /change-plans"), "404 must point at the dry-run endpoint")
    }

    @Test
    fun `should return 404 with recovery guidance when the plan has expired`(@TempDir root: Path) = testApplication {
        val albumId = Uuid.random()
        val from = root.resolve("incoming/kob")
        writeFlac(from, "01.flac")
        val repo = MutableAlbumRepository(album(albumId, from.toString()))
        // A clock fixed in the past: every entry is immediately older than the zero TTL, so the
        // plan is expired by the time apply looks it up.
        val store = InMemoryChangePlanStore(ttl = kotlin.time.Duration.ZERO)
        val plan = relayoutPlan(
            ReleaseChangeSet(albumId, DirectoryMove(albumId, from.toString(), root.resolve("x").toString()), emptyList(), emptyList()),
        )
        store.put(plan)
        val applyService = wireRoutes(repo, root, store)

        install(ContentNegotiation) { json(json) }
        routing { changePlanRoutes(facadeFor(applyService), applyService) }
        val client = createClient { install(ClientContentNegotiation) { json(json) } }

        val response = client.post("/change-plans/${plan.id}/apply")

        assertEquals(HttpStatusCode.NotFound, response.status)
        val error = response.body<ErrorResponse>()
        assertEquals("RESOURCE_NOT_FOUND", error.code)
        assertTrue(error.message.contains(plan.id.toString()), "message must name the missing plan")
        assertTrue(error.message.contains("Run a new dry run"), "message must guide recompute of the dry run")
    }

    @Test
    fun `should return 400 for an invalid plan id`(@TempDir root: Path) = testApplication {
        val repo = MutableAlbumRepository()
        val store = InMemoryChangePlanStore()
        val applyService = wireRoutes(repo, root, store)

        install(ContentNegotiation) { json(json) }
        routing { changePlanRoutes(facadeFor(applyService), applyService) }
        val client = createClient { install(ClientContentNegotiation) { json(json) } }

        val response = client.post("/change-plans/not-a-uuid/apply")

        assertEquals(HttpStatusCode.BadRequest, response.status)
        assertEquals("INVALID_PLAN_ID", response.body<ErrorResponse>().code)
    }
}
