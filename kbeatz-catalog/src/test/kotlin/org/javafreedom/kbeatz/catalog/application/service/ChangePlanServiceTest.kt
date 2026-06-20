package org.javafreedom.kbeatz.catalog.application.service

import io.mockk.every
import io.mockk.mockk
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.uuid.Uuid
import kotlinx.coroutines.test.runTest
import org.javafreedom.kbeatz.catalog.domain.model.Album
import org.javafreedom.kbeatz.catalog.domain.model.ChangeOperation
import org.javafreedom.kbeatz.catalog.domain.model.ConflictType
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumFilter
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumRepository
import org.javafreedom.kbeatz.catalog.domain.repository.TrackRepository
import org.javafreedom.kbeatz.catalog.domain.service.DirectoryLayoutPlanner
import org.javafreedom.kbeatz.catalog.domain.model.DirectoryTemplate
import org.javafreedom.kbeatz.common.BusinessValidationException
import org.javafreedom.kbeatz.common.PathTraversalException

class ChangePlanServiceTest {

    private val libraryRoot = "/srv/music"
    private val template = "\${ALBUMARTIST}/\${ALBUM} (\${DATE})"
    private val trackRepository: TrackRepository = mockk()

    /**
     * In-memory album repository. Counts [findById] and [findByIds] invocations so tests can
     * assert that relayout planning uses the single batch query and not the per-album N+1 loop.
     */
    private class FakeAlbumRepository(albums: List<Album>) : AlbumRepository {
        private val byId = albums.associateBy { it.id }
        var findByIdCalls: Int = 0
            private set
        var findByIdsCalls: Int = 0
            private set

        override suspend fun findById(id: Uuid): Album? {
            findByIdCalls++
            return byId[id]
        }
        override suspend fun findByIds(ids: List<Uuid>): List<Album> {
            findByIdsCalls++
            return ids.mapNotNull { byId[it] }
        }
        override suspend fun findByDirectoryPath(directoryPath: String): Album? =
            byId.values.firstOrNull { it.directoryPath == directoryPath }
        override suspend fun findAllWithCount(page: Int, size: Int, filter: AlbumFilter) =
            byId.values.toList() to byId.size.toLong()
        override suspend fun save(album: Album): Album = album
        override suspend fun saveAll(albums: List<Album>) = Unit
    }

    private fun album(
        id: Uuid = Uuid.random(),
        directoryPath: String,
        albumArtist: String = "Miles Davis",
        album: String = "Kind of Blue",
        date: String? = "1959",
        mergedDirectories: List<String> = emptyList(),
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
        mergedDirectories = mergedDirectories,
    )

    private class StubFilesystem(
        val pathExists: (String) -> Boolean = { true },
        val lockHeldFn: (String) -> Boolean = { false },
    ) : PlanningFilesystem {
        override fun exists(absolutePath: String): Boolean = pathExists(absolutePath)
        override fun lockHeld(directory: String): Boolean = lockHeldFn(directory)
    }

    private fun service(
        albums: List<Album>,
        pathExists: (String) -> Boolean = { true },
        lockHeld: (String) -> Boolean = { false },
    ) = ChangePlanService(
        albumRepository = FakeAlbumRepository(albums),
        trackRepository = trackRepository,
        directoryLayoutPlanner = DirectoryLayoutPlanner(DirectoryTemplate(template)),
        libraryRoot = libraryRoot,
        filesystem = StubFilesystem(pathExists, lockHeld),
    )

    private val targetPath = "/srv/music/Miles Davis/Kind of Blue (1959)"

    @Test
    fun `planRelayout reports no move when directory already matches template`() = runTest {
        val matching = album(directoryPath = targetPath)

        val plan = service(listOf(matching)).planRelayout(listOf(matching.id))

        assertEquals(ChangeOperation.RELAYOUT, plan.operation)
        assertEquals(1, plan.releases.size)
        assertNull(plan.releases.single().directoryMove)
        assertFalse(plan.hasConflicts)
        assertEquals(0, plan.totalMoves)
    }

    @Test
    fun `planRelayout reports exact source to target move when directory differs`() = runTest {
        val release = album(directoryPath = "/srv/music/incoming/kob")

        val plan = service(
            listOf(release),
            pathExists = { it == "/srv/music/incoming/kob" },
        ).planRelayout(listOf(release.id))

        val move = assertNotNull(plan.releases.single().directoryMove)
        assertEquals("/srv/music/incoming/kob", move.fromPath)
        assertEquals(targetPath, move.toPath)
        assertFalse(plan.hasConflicts)
    }

    @Test
    fun `planRelayout carries merged directories on the move`() = runTest {
        val release = album(
            directoryPath = "/srv/music/incoming/kob",
            mergedDirectories = listOf("/srv/music/backup/kob"),
        )

        val plan = service(
            listOf(release),
            pathExists = { it == "/srv/music/incoming/kob" },
        ).planRelayout(listOf(release.id))

        val move = assertNotNull(plan.releases.single().directoryMove)
        assertEquals(listOf("/srv/music/backup/kob"), move.mergedFromPaths)
    }

    @Test
    fun `planRelayout reports TARGET_EXISTS conflict when target already on disk`() = runTest {
        val release = album(directoryPath = "/srv/music/incoming/kob")

        val plan = service(
            listOf(release),
            pathExists = { true },
        ).planRelayout(listOf(release.id))

        val conflicts = plan.releases.single().conflicts
        assertTrue(conflicts.any { it.type == ConflictType.TARGET_EXISTS })
        assertTrue(plan.hasConflicts)
    }

    @Test
    fun `planRelayout reports SOURCE_MISSING conflict when source absent`() = runTest {
        val release = album(directoryPath = "/srv/music/incoming/kob")

        val plan = service(
            listOf(release),
            pathExists = { false },
        ).planRelayout(listOf(release.id))

        val conflicts = plan.releases.single().conflicts
        assertEquals(ConflictType.SOURCE_MISSING, conflicts.single().type)
    }

    @Test
    fun `planRelayout reports SOURCE_MISSING conflict when album not found`() = runTest {
        val missingId = Uuid.random()

        val plan = service(emptyList()).planRelayout(listOf(missingId))

        val conflicts = plan.releases.single().conflicts
        assertEquals(ConflictType.SOURCE_MISSING, conflicts.single().type)
        assertEquals("Album not found", conflicts.single().message)
    }

    @Test
    fun `planRelayout reports LOCK_HELD conflict when write lock present`() = runTest {
        val release = album(directoryPath = "/srv/music/incoming/kob")

        val plan = service(
            listOf(release),
            pathExists = { it == "/srv/music/incoming/kob" },
            lockHeld = { true },
        ).planRelayout(listOf(release.id))

        val conflicts = plan.releases.single().conflicts
        assertTrue(conflicts.any { it.type == ConflictType.LOCK_HELD })
    }

    @Test
    fun `planRelayout reports PATH_TRAVERSAL conflict instead of failing`() = runTest {
        val release = album(directoryPath = "/srv/music/incoming/kob")
        // Force the traversal guard so the catch-and-convert branch is exercised; the planner's
        // own sanitisation normally prevents this, so we stub it directly.
        val throwingPlanner: DirectoryLayoutPlanner = mockk()
        every { throwingPlanner.planTargetDirectory(release, libraryRoot) } throws
            PathTraversalException("Planned directory escapes the library root")
        val svc = ChangePlanService(
            albumRepository = FakeAlbumRepository(listOf(release)),
            trackRepository = trackRepository,
            directoryLayoutPlanner = throwingPlanner,
            libraryRoot = libraryRoot,
        )

        val plan = svc.planRelayout(listOf(release.id))

        val conflicts = plan.releases.single().conflicts
        assertEquals(ConflictType.PATH_TRAVERSAL, conflicts.single().type)
        assertNull(plan.releases.single().directoryMove)
    }

    @Test
    fun `planRelayout consolidates many releases into one plan`() = runTest {
        val matching = album(directoryPath = targetPath)
        val moving = album(
            id = Uuid.random(),
            directoryPath = "/srv/music/incoming/two",
            albumArtist = "John Coltrane",
            album = "Blue Train",
            date = "1957",
        )

        val plan = service(
            listOf(matching, moving),
            pathExists = { it == targetPath || it == "/srv/music/incoming/two" },
        ).planRelayout(listOf(matching.id, moving.id))

        assertEquals(1, plan.totalMoves)
        assertEquals(2, plan.releases.size)
        assertNull(plan.releases.first { it.albumId == matching.id }.directoryMove)
        assertNotNull(plan.releases.first { it.albumId == moving.id }.directoryMove)
    }

    @Test
    fun `planRelayout plans existing albums and reports SOURCE_MISSING for absent ids in input order`() = runTest {
        val matching = album(directoryPath = targetPath)
        val moving = album(
            id = Uuid.random(),
            directoryPath = "/srv/music/incoming/two",
            albumArtist = "John Coltrane",
            album = "Blue Train",
            date = "1957",
        )
        val missingId = Uuid.random()
        // Interleave a missing id between two present albums to prove ordering is preserved.
        val requested = listOf(matching.id, missingId, moving.id)

        val plan = service(
            listOf(matching, moving),
            pathExists = { it == targetPath || it == "/srv/music/incoming/two" },
        ).planRelayout(requested)

        assertEquals(requested, plan.releases.map { it.albumId })
        assertEquals(1, plan.totalMoves)
        assertNull(plan.releases.first { it.albumId == matching.id }.directoryMove)
        assertNotNull(plan.releases.first { it.albumId == moving.id }.directoryMove)

        val missingConflicts = plan.releases.first { it.albumId == missingId }.conflicts
        assertEquals(ConflictType.SOURCE_MISSING, missingConflicts.single().type)
        assertEquals("Album not found", missingConflicts.single().message)
    }

    @Test
    fun `planRelayout uses a single batch fetch and never calls findById per album`() = runTest {
        val matching = album(directoryPath = targetPath)
        val moving = album(
            id = Uuid.random(),
            directoryPath = "/srv/music/incoming/two",
            albumArtist = "John Coltrane",
            album = "Blue Train",
            date = "1957",
        )
        val repo = FakeAlbumRepository(listOf(matching, moving))
        val svc = ChangePlanService(
            albumRepository = repo,
            trackRepository = trackRepository,
            directoryLayoutPlanner = DirectoryLayoutPlanner(DirectoryTemplate(template)),
            libraryRoot = libraryRoot,
            filesystem = StubFilesystem(
                pathExists = { it == targetPath || it == "/srv/music/incoming/two" },
            ),
        )

        svc.planRelayout(listOf(matching.id, Uuid.random(), moving.id))

        assertEquals(1, repo.findByIdsCalls)
        assertEquals(0, repo.findByIdCalls)
    }

    @Test
    fun `planTagChanges produces diffs for RETAG`() = runTest {
        val albumId = Uuid.random()
        val plan = service(emptyList()).planTagChanges(
            operation = ChangeOperation.RETAG,
            proposedByAlbum = mapOf(albumId to mapOf("ALBUM" to "New", "GENRE" to "Jazz")),
            currentByAlbum = mapOf(albumId to mapOf("ALBUM" to "Old")),
        )

        assertEquals(ChangeOperation.RETAG, plan.operation)
        val changes = plan.releases.single().tagChanges
        assertEquals(listOf("ALBUM", "GENRE"), changes.map { it.field })
        assertNull(plan.releases.single().directoryMove)
    }

    @Test
    fun `planTagChanges produces diffs for DISCOGS_SYNC`() = runTest {
        val albumId = Uuid.random()
        val plan = service(emptyList()).planTagChanges(
            operation = ChangeOperation.DISCOGS_SYNC,
            proposedByAlbum = mapOf(albumId to mapOf("LABEL" to "Blue Note")),
            currentByAlbum = mapOf(albumId to mapOf("LABEL" to "Columbia")),
        )

        assertEquals(ChangeOperation.DISCOGS_SYNC, plan.operation)
        assertEquals(1, plan.totalTagChanges)
    }

    @Test
    fun `planTagChanges handles missing current map as all additions`() = runTest {
        val albumId = Uuid.random()
        val plan = service(emptyList()).planTagChanges(
            operation = ChangeOperation.RETAG,
            proposedByAlbum = mapOf(albumId to mapOf("ALBUM" to "New")),
            currentByAlbum = emptyMap(),
        )

        val change = plan.releases.single().tagChanges.single()
        assertNull(change.currentValue)
        assertEquals("New", change.proposedValue)
    }

    @Test
    fun `planTagChanges rejects RELAYOUT operation`() = runTest {
        assertFailsWith<BusinessValidationException> {
            service(emptyList()).planTagChanges(
                operation = ChangeOperation.RELAYOUT,
                proposedByAlbum = emptyMap(),
                currentByAlbum = emptyMap(),
            )
        }
    }
}
