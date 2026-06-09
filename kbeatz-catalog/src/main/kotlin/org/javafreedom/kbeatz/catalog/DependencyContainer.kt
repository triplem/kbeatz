package org.javafreedom.kbeatz.catalog

import java.nio.file.Path
import org.javafreedom.kbeatz.catalog.application.service.AlbumService
import org.javafreedom.kbeatz.catalog.application.service.CoverArtService
import org.javafreedom.kbeatz.catalog.application.service.LibraryScanService
import org.javafreedom.kbeatz.catalog.application.service.LibraryWalker
import org.javafreedom.kbeatz.catalog.application.service.TagWriteService
import org.javafreedom.kbeatz.catalog.domain.port.SyncProvider
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumRepository
import org.javafreedom.kbeatz.catalog.infrastructure.persistence.AlbumsTable
import org.javafreedom.kbeatz.catalog.infrastructure.persistence.DbFactory
import org.javafreedom.kbeatz.catalog.infrastructure.persistence.ExposedAlbumRepository
import org.javafreedom.kbeatz.catalog.infrastructure.persistence.ExposedTrackRepository
import org.javafreedom.kbeatz.catalog.infrastructure.sync.buildDiscogsSyncProvider
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
    val scanService = LibraryScanService(
        libraryRoot = libraryRootPath,
        walker = LibraryWalker(),
        albumRepository = albumRepository,
        repairTimeoutSeconds = config.repairTimeoutSeconds,
    )
    val syncService: SyncProvider = buildDiscogsSyncProvider(config, albumRepository, libraryRootPath, dataDirPath)
    val tagWriteService = TagWriteService(albumRepository, trackRepository, libraryRootPath)

    /**
     * Liveness probe for the database: executes a minimal query against AlbumsTable.
     * Kept here so Application.kt has no direct dependency on infrastructure classes.
     */
    val dbProbe: suspend () -> Boolean = {
        suspendTransaction { AlbumsTable.selectAll().limit(1).count() >= 0 }
    }
}
