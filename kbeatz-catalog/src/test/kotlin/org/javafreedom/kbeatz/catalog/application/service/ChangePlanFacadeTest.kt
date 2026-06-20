package org.javafreedom.kbeatz.catalog.application.service

import io.mockk.coEvery
import io.mockk.mockk
import java.nio.file.Files
import java.nio.file.Path
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue
import kotlin.uuid.Uuid
import kotlinx.coroutines.test.runTest
import kotlinx.io.files.Path as KtPath
import org.javafreedom.kbeatz.catalog.domain.model.Album
import org.javafreedom.kbeatz.catalog.domain.model.ChangeOperation
import org.javafreedom.kbeatz.catalog.domain.model.DirectoryTemplate
import org.javafreedom.kbeatz.catalog.domain.model.SyncFieldChange
import org.javafreedom.kbeatz.catalog.domain.model.SyncPreview
import org.javafreedom.kbeatz.catalog.domain.model.SyncResult
import org.javafreedom.kbeatz.catalog.domain.port.SyncProvider
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumRepository
import org.javafreedom.kbeatz.catalog.domain.repository.TrackRepository
import org.javafreedom.kbeatz.catalog.domain.service.DirectoryLayoutPlanner
import org.javafreedom.kbeatz.catalog.infrastructure.move.DirectoryMoveExecutor
import org.javafreedom.kbeatz.catalog.infrastructure.tag.FlacTagWriter
import org.javafreedom.kbeatz.common.BusinessValidationException
import org.javafreedom.kbeatz.tagger.codec.flac.FlacFile

/**
 * Unit tests for the DISCOGS_SYNC routing through [ChangePlanFacade] (story #817): dry-run plan
 * generation for one and many releases, conflicts surfaced as data, and an end-to-end apply that
 * writes the proposed tags to a real FLAC file via the shared write path.
 */
class ChangePlanFacadeTest {

    private val libraryRoot: Path = Files.createTempDirectory("facade-root")
    private val template = "\${ALBUMARTIST}/\${ALBUM} (\${DATE})"

    @AfterTest
    fun cleanUp() {
        libraryRoot.toFile().deleteRecursively()
    }

    private class FakeSyncProvider(
        private val previews: Map<Uuid, SyncPreview> = emptyMap(),
        private val failures: Map<Uuid, () -> Nothing> = emptyMap(),
    ) : SyncProvider {
        override val name = "fake"
        override suspend fun preview(albumId: Uuid): SyncPreview {
            failures[albumId]?.invoke()
            return previews[albumId] ?: SyncPreview(albumId, emptyList())
        }
        override suspend fun sync(albumId: Uuid, downloadImages: Boolean): SyncResult =
            error("not used")
    }

    private fun planService(albumRepository: AlbumRepository) = ChangePlanService(
        albumRepository = albumRepository,
        trackRepository = mockk<TrackRepository>(),
        directoryLayoutPlanner = DirectoryLayoutPlanner(DirectoryTemplate(template)),
        libraryRoot = libraryRoot.toString(),
    )

    private fun facade(syncProvider: SyncProvider, albumRepository: AlbumRepository = mockk()) =
        ChangePlanFacade(planService(albumRepository), InMemoryChangePlanStore(), syncProvider)

    @Test
    fun `createPlan DISCOGS_SYNC produces tag diffs for a single album`() = runTest {
        val albumId = Uuid.random()
        val provider = FakeSyncProvider(
            previews = mapOf(
                albumId to SyncPreview(
                    albumId,
                    listOf(
                        SyncFieldChange("GENRE", currentValue = "Rock", proposedValue = "Jazz"),
                        SyncFieldChange("LABEL", currentValue = "", proposedValue = "Columbia"),
                    ),
                ),
            ),
        )

        val plan = facade(provider).createPlan(ChangeOperation.DISCOGS_SYNC, listOf(albumId))

        assertEquals(ChangeOperation.DISCOGS_SYNC, plan.operation)
        val changes = plan.releases.single().tagChanges.associateBy { it.field }
        assertEquals("Jazz", changes.getValue("GENRE").proposedValue)
        assertEquals("Rock", changes.getValue("GENRE").currentValue)
        assertEquals("Columbia", changes.getValue("LABEL").proposedValue)
        assertEquals(0, plan.totalConflicts)
    }

    @Test
    fun `createPlan DISCOGS_SYNC produces a consolidated plan for many albums`() = runTest {
        val a = Uuid.random()
        val b = Uuid.random()
        val provider = FakeSyncProvider(
            previews = mapOf(
                a to SyncPreview(a, listOf(SyncFieldChange("GENRE", "", "Jazz"))),
                b to SyncPreview(b, listOf(SyncFieldChange("LABEL", "", "Blue Note"))),
            ),
        )

        val plan = facade(provider).createPlan(ChangeOperation.DISCOGS_SYNC, listOf(a, b))

        assertEquals(2, plan.releases.size)
        assertEquals(2, plan.totalTagChanges)
    }

    @Test
    fun `createPlan DISCOGS_SYNC surfaces a preview failure as a conflict instead of failing`() = runTest {
        val ok = Uuid.random()
        val bad = Uuid.random()
        val provider = FakeSyncProvider(
            previews = mapOf(ok to SyncPreview(ok, listOf(SyncFieldChange("GENRE", "", "Jazz")))),
            failures = mapOf(bad to { throw BusinessValidationException("no Discogs id") }),
        )

        val plan = facade(provider).createPlan(ChangeOperation.DISCOGS_SYNC, listOf(ok, bad))

        assertEquals(2, plan.releases.size)
        assertTrue(plan.hasConflicts)
        val badRelease = plan.releases.single { it.albumId == bad }
        assertTrue(badRelease.hasConflicts)
        assertTrue(badRelease.tagChanges.isEmpty())
        assertEquals("no Discogs id", badRelease.conflicts.single().message)
        // The healthy album still planned successfully.
        assertEquals(1, plan.releases.single { it.albumId == ok }.tagChanges.size)
    }

    @Test
    fun `createPlan RETAG via the generic endpoint is unavailable`() = runTest {
        assertFailsWith<OperationNotAvailableException> {
            facade(FakeSyncProvider()).createPlan(ChangeOperation.RETAG, listOf(Uuid.random()))
        }
    }

    @Test
    fun `createPlan rejects an empty album list`() = runTest {
        assertFailsWith<BusinessValidationException> {
            facade(FakeSyncProvider()).createPlan(ChangeOperation.DISCOGS_SYNC, emptyList())
        }
    }

    @Test
    fun `applying a DISCOGS_SYNC plan writes the proposed tags to the FLAC files`() = runTest {
        val albumDir = Files.createTempDirectory(libraryRoot, "album")
        val flac = albumDir.resolve("01.flac")
        copyFixture(flac)

        val albumId = Uuid.random()
        val album = album(albumId, albumDir.toString())
        val albumRepository = mockk<AlbumRepository>()
        coEvery { albumRepository.findById(albumId) } returns album

        val provider = FakeSyncProvider(
            previews = mapOf(
                albumId to SyncPreview(
                    albumId,
                    listOf(SyncFieldChange("GENRE", currentValue = "", proposedValue = "Modal Jazz")),
                ),
            ),
        )

        val store = InMemoryChangePlanStore()
        val facade = ChangePlanFacade(planService(albumRepository), store, provider)
        val applyService = ChangePlanApplyService(
            store = store,
            directoryMoveExecutor = mockk<DirectoryMoveExecutor>(),
            tagChangeApplier = FlacTagChangeApplier(albumRepository, FlacTagWriter(libraryRoot)),
        )

        val plan = facade.createPlan(ChangeOperation.DISCOGS_SYNC, listOf(albumId))
        val result = applyService.apply(plan.id)

        assertEquals(1, result.appliedCount)
        assertEquals("Modal Jazz", tagValue(flac, "GENRE"))
    }

    private fun album(id: Uuid, dir: String) = Album(
        id = id,
        albumArtist = "Miles Davis",
        album = "Kind of Blue",
        date = null,
        genre = null,
        label = null,
        catalogNumber = null,
        composer = null,
        conductor = null,
        ensemble = null,
        discogsId = "12345",
        directoryPath = dir,
        extraTags = null,
        images = null,
    )

    private fun copyFixture(dest: Path) {
        val resource = checkNotNull(
            ChangePlanFacadeTest::class.java.classLoader.getResource("with-tags.flac"),
        ) { "with-tags.flac fixture not found in test resources" }
        Files.copy(Path.of(resource.toURI()), dest)
    }

    private fun tagValue(flac: Path, field: String): String? =
        FlacFile.read(KtPath(flac.toString())).vorbisComment
            ?.comments
            ?.firstOrNull { it.substringBefore('=').equals(field, ignoreCase = true) }
            ?.substringAfter('=')
}
