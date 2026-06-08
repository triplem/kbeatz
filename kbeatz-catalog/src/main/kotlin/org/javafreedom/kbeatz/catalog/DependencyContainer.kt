package org.javafreedom.kbeatz.catalog

import java.nio.file.Path
import org.javafreedom.kbeatz.catalog.application.service.AlbumService
import org.javafreedom.kbeatz.catalog.application.service.CoverArtService
import org.javafreedom.kbeatz.catalog.application.service.DiscogsImageService
import org.javafreedom.kbeatz.catalog.application.service.DiscogsSyncService
import org.javafreedom.kbeatz.catalog.application.service.LibraryScanService
import org.javafreedom.kbeatz.catalog.application.service.LibraryWalker
import org.javafreedom.kbeatz.catalog.application.service.TagWriteService
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumRepository
import org.javafreedom.kbeatz.catalog.infrastructure.persistence.AlbumsTable
import org.javafreedom.kbeatz.catalog.infrastructure.persistence.DbFactory
import org.javafreedom.kbeatz.catalog.infrastructure.persistence.ExposedAlbumRepository
import org.javafreedom.kbeatz.catalog.infrastructure.persistence.ExposedTrackRepository
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.suspendTransaction
import org.javafreedom.kbeatz.sources.MetadataSource
import org.javafreedom.kbeatz.sources.discogs.DiscogsImageQuota
import org.javafreedom.kbeatz.sources.discogs.DiscogsMetadataSource
import org.javafreedom.kbeatz.sources.discogs.DiscogsTokenBucket

/**
 * Wires all outbound adapters (infrastructure) to their port interfaces and constructs
 * the application-layer services.
 *
 * Application.kt depends on this class only through the port interfaces and service types
 * exposed as properties, keeping the hexagonal architecture boundary clean.
 */
class DependencyContainer(config: AppConfig, libraryRootPath: Path, dataDirPath: Path) {

    val dataSource: AutoCloseable = DbFactory.init(config.jdbcUrl)

    private val albumRepository: AlbumRepository = ExposedAlbumRepository()
    private val trackRepository = ExposedTrackRepository()

    val albumService = AlbumService(albumRepository, trackRepository)
    val coverArtService = CoverArtService(albumRepository, libraryRootPath)
    val scanService = LibraryScanService(
        libraryRoot = libraryRootPath,
        walker = LibraryWalker(),
        albumRepository = albumRepository,
    )
    val syncService = buildSyncService(config, albumRepository, libraryRootPath, dataDirPath)
    val tagWriteService = TagWriteService(albumRepository, trackRepository, libraryRootPath)

    /**
     * Liveness probe for the database: executes a minimal query against AlbumsTable.
     * Kept here so Application.kt has no direct dependency on infrastructure classes.
     */
    val dbProbe: suspend () -> Boolean = {
        suspendTransaction { AlbumsTable.selectAll().limit(1).count() >= 0 }
    }
}

/** Placeholder used when DISCOGS_TOKEN is not configured. All calls throw immediately. */
private object UnavailableMetadataSource : MetadataSource {
    override val name = "discogs"
    override suspend fun fetchRelease(releaseId: String) =
        error("Discogs sync unavailable - DISCOGS_TOKEN is not configured")

    override suspend fun fetchImage(releaseId: String, index: Int) =
        error("Discogs sync unavailable - DISCOGS_TOKEN is not configured")
}

private fun buildSyncService(
    config: AppConfig,
    albumRepository: AlbumRepository,
    libraryRootPath: Path,
    dataDir: Path,
): DiscogsSyncService {
    val token = config.discogsToken
    if (token == null) {
        return DiscogsSyncService(
            albumRepository = albumRepository,
            metadataSource = UnavailableMetadataSource,
            imageService = null,
            libraryRoot = libraryRootPath,
        )
    }
    val quotaFile = dataDir.resolve("discogs-image-quota.json")
    val imageQuota = DiscogsImageQuota(quotaFile = quotaFile)
    val metadataSource = DiscogsMetadataSource(
        token = token,
        imageQuota = imageQuota,
        tokenBucket = DiscogsTokenBucket(),
    )
    val imageService = DiscogsImageService(
        metadataSource = metadataSource,
        imageQuota = imageQuota,
    )
    return DiscogsSyncService(
        albumRepository = albumRepository,
        metadataSource = metadataSource,
        imageService = imageService,
        libraryRoot = libraryRootPath,
    )
}
