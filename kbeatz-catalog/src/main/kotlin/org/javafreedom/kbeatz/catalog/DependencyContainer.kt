package org.javafreedom.kbeatz.catalog

import java.nio.file.Path
import kotlin.time.Duration.Companion.minutes
import kotlinx.coroutines.Dispatchers
import org.javafreedom.kbeatz.catalog.application.service.AlbumService
import org.javafreedom.kbeatz.catalog.application.service.ChangePlanApplyService
import org.javafreedom.kbeatz.catalog.application.service.ChangePlanFacade
import org.javafreedom.kbeatz.catalog.application.service.ChangePlanService
import org.javafreedom.kbeatz.catalog.application.service.CoverArtService
import org.javafreedom.kbeatz.catalog.application.service.FlacTagChangeApplier
import org.javafreedom.kbeatz.catalog.application.service.InMemoryChangePlanStore
import org.javafreedom.kbeatz.catalog.application.service.LibraryScanService
import org.javafreedom.kbeatz.catalog.application.service.LibraryWalker
import org.javafreedom.kbeatz.catalog.application.service.TagWriteService
import org.javafreedom.kbeatz.catalog.domain.model.DirectoryTemplate
import org.javafreedom.kbeatz.catalog.domain.port.SyncProvider
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumRepository
import org.javafreedom.kbeatz.catalog.domain.service.DirectoryLayoutPlanner
import org.javafreedom.kbeatz.catalog.infrastructure.persistence.AlbumsTable
import org.javafreedom.kbeatz.catalog.infrastructure.persistence.DbFactory
import org.javafreedom.kbeatz.catalog.infrastructure.persistence.ExposedAlbumRepository
import org.javafreedom.kbeatz.catalog.infrastructure.move.DirectoryMoveExecutor
import org.javafreedom.kbeatz.catalog.infrastructure.move.DirectoryMoveRecovery
import org.javafreedom.kbeatz.catalog.infrastructure.persistence.ExposedTrackRepository
import org.javafreedom.kbeatz.catalog.infrastructure.sync.buildDiscogsSyncProvider
import org.javafreedom.kbeatz.catalog.infrastructure.tag.FlacTagWriter
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.suspendTransaction

/**
 * Wires all outbound adapters (infrastructure) to their port interfaces and constructs
 * the application-layer services.
 *
 * Application.kt depends on this class only through the port interfaces and service types
 * exposed as properties, keeping the hexagonal architecture boundary clean.
 */
class DependencyContainer(config: AppConfig, libraryRootPath: Path, dataDirPath: Path) {

    val dataSource: AutoCloseable = DbFactory.init(config.jdbcUrl, config.dbUser, config.dbPassword)

    private val albumRepository: AlbumRepository = ExposedAlbumRepository()
    private val trackRepository = ExposedTrackRepository()

    val albumService = AlbumService(albumRepository, trackRepository)
    val coverArtService = CoverArtService(albumRepository, libraryRootPath)
    // Concurrency model (issue #374): the entire scan pipeline (filesystem walk +
    // FLAC tag reads + H2 writes) runs on a single coroutine dispatched to
    // Dispatchers.IO.limitedParallelism(N), where N = catalog.scan.parallelism.
    // Default N=4 prevents seek contention on spinning-disk libraries.
    // Increase N for SSD libraries; set N=1 for fully sequential reads.
    // InjectDispatcher: suppressed here because DependencyContainer IS the injection point;
    // Dispatchers.IO is created once and injected into LibraryScanService, not used directly.
    @Suppress("InjectDispatcher")
    val scanService = LibraryScanService(
        libraryRoot = libraryRootPath,
        walker = LibraryWalker(),
        albumRepository = albumRepository,
        trackRepository = trackRepository,
        repairTimeoutSeconds = config.repairTimeoutSeconds,
        scanDispatcher = Dispatchers.IO.limitedParallelism(config.scanParallelism),
    )
    // The single, shared FLAC tag-write path (issue #817). Manual retag (TagWriteService), Discogs
    // sync (DiscogsSyncService) and change-plan apply (FlacTagChangeApplier) all write FLAC tags
    // through this one collaborator, so there is no second on-disk tag-write code path (AC-E10).
    private val flacTagWriter = FlacTagWriter(libraryRootPath)

    val syncService: SyncProvider =
        buildDiscogsSyncProvider(config, albumRepository, libraryRootPath, dataDirPath, flacTagWriter)
    val tagWriteService = TagWriteService(albumRepository, trackRepository, libraryRootPath, flacTagWriter)

    // Active directory-structure template + planner, shared by the change-plan pipeline (#815)
    // and the read-only layout settings/preview endpoints (#818). The template is operator
    // configuration; both consumers reuse this single validated instance.
    val layoutDirectoryTemplate: String = config.layoutDirectoryTemplate
    val directoryLayoutPlanner = DirectoryLayoutPlanner(DirectoryTemplate(layoutDirectoryTemplate))

    /** Exposes the album repository so read-only adapters (e.g. layout preview, #818) can load albums. */
    val albums: AlbumRepository = albumRepository

    // Dry-run change-plan pipeline (issue #815). The plan service performs zero disk writes;
    // the store is a process-lifetime singleton shared with the apply step (issue #816).
    private val changePlanService = ChangePlanService(
        albumRepository = albumRepository,
        directoryLayoutPlanner = directoryLayoutPlanner,
        libraryRoot = config.catalogLibraryRoot,
    )

    // Process-lifetime store shared between the planning step (#815) and the apply step (#816),
    // so a plan computed by createPlan can be looked up by id and applied. Bounded retention
    // (issue #961): plans expire after a TTL and the store is capped, so the map cannot grow
    // without limit across a long-running process.
    private val changePlanStore = InMemoryChangePlanStore(
        ttl = config.changePlanTtlMinutes.minutes,
        maxRetainedPlans = config.changePlanMaxRetained,
    )

    /**
     * Computes, stores, and retrieves dry-run change plans (issue #815). DISCOGS_SYNC plans are
     * sourced from the active [syncService] preview (issue #817).
     */
    val changePlanFacade = ChangePlanFacade(changePlanService, changePlanStore, syncService)

    /** Executes directory moves on disk with journalled crash safety (issue #814). */
    val directoryMoveExecutor = DirectoryMoveExecutor(albumRepository, libraryRootPath, dataDirPath)

    /**
     * Applies a stored change plan by id (issue #816): atomic per-release moves via
     * [directoryMoveExecutor], idempotent re-apply, per-release outcome reporting. Tag changes are
     * written through [FlacTagChangeApplier], which routes to the single shared FLAC tag-write path
     * (issue #817).
     */
    val changePlanApplyService = ChangePlanApplyService(
        store = changePlanStore,
        directoryMoveExecutor = directoryMoveExecutor,
        tagChangeApplier = FlacTagChangeApplier(albumRepository, flacTagWriter),
    )

    /** Reconciles directory moves interrupted by a process kill; runs at startup before traffic. */
    val directoryMoveRecovery = DirectoryMoveRecovery(albumRepository, dataDirPath)

    /**
     * Liveness probe for the database: executes a minimal query against AlbumsTable.
     * Kept here so Application.kt has no direct dependency on infrastructure classes.
     */
    val dbProbe: suspend () -> Boolean = {
        suspendTransaction { AlbumsTable.selectAll().limit(1).count() >= 0 }
    }
}
