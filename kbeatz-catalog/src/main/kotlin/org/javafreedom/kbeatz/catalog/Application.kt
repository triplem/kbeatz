package org.javafreedom.kbeatz.catalog

import io.ktor.server.application.*
import io.ktor.server.cio.*
import io.ktor.server.engine.*
import io.ktor.util.AttributeKey
import java.nio.file.Path
import kotlinx.coroutines.runBlocking
import org.javafreedom.kbeatz.catalog.application.service.AlbumService
import org.javafreedom.kbeatz.catalog.application.service.CoverArtService
import org.javafreedom.kbeatz.catalog.application.service.DiscogsSyncService
import org.javafreedom.kbeatz.catalog.application.service.DiscogsImageService
import org.javafreedom.kbeatz.catalog.application.service.LibraryScanService
import org.javafreedom.kbeatz.catalog.application.service.LibraryWalker
import org.javafreedom.kbeatz.catalog.application.service.TagWriteService
import org.javafreedom.kbeatz.catalog.infrastructure.persistence.DbFactory
import org.javafreedom.kbeatz.catalog.infrastructure.persistence.ExposedAlbumRepository
import org.javafreedom.kbeatz.catalog.infrastructure.persistence.ExposedTrackRepository
import org.javafreedom.kbeatz.catalog.plugins.configureLogging
import org.javafreedom.kbeatz.catalog.plugins.configurePathTraversalGuard
import org.javafreedom.kbeatz.catalog.plugins.configureRouting
import org.javafreedom.kbeatz.catalog.plugins.configureSerialization
import org.javafreedom.kbeatz.catalog.plugins.configureStatusPages
import org.javafreedom.kbeatz.sources.ImageResult
import org.javafreedom.kbeatz.sources.MetadataSource
import org.javafreedom.kbeatz.sources.Release
import org.javafreedom.kbeatz.sources.discogs.DiscogsImageQuota
import org.javafreedom.kbeatz.sources.discogs.DiscogsMetadataSource
import org.javafreedom.kbeatz.sources.discogs.DiscogsTokenBucket

val AppConfigKey = AttributeKey<AppConfig>("AppConfig")
val ScanServiceKey = AttributeKey<LibraryScanService>("LibraryScanService")
val AlbumServiceKey = AttributeKey<AlbumService>("AlbumService")

/** Placeholder used when DISCOGS_TOKEN is not configured. All calls throw immediately. */
private object UnavailableMetadataSource : MetadataSource {
    override val name = "discogs"
    override suspend fun fetchRelease(releaseId: String): Release? =
        error("Discogs sync unavailable — DISCOGS_TOKEN is not configured")
    override suspend fun fetchImage(releaseId: String, index: Int): ImageResult? =
        error("Discogs sync unavailable — DISCOGS_TOKEN is not configured")
}

fun main() {
    embeddedServer(CIO, port = 8080, host = "0.0.0.0", module = Application::module).start(wait = true)
}

@Suppress("TooGenericExceptionCaught") // startup failures should crash the application
fun Application.module() {
    val config = AppConfig.fromEnv()
    attributes.put(AppConfigKey, config)

    // Initialise database and run Liquibase migrations
    val dataSource = DbFactory.init(config.jdbcUrl)

    // Wire repositories and services
    val albumRepository = ExposedAlbumRepository()
    val trackRepository = ExposedTrackRepository()
    val albumService = AlbumService(albumRepository, trackRepository)
    val libraryRootPath = Path.of(config.catalogLibraryRoot)
    val coverArtService = CoverArtService(albumRepository, libraryRootPath)
    val walker = LibraryWalker()
    val scanService = LibraryScanService(
        libraryRoot = libraryRootPath,
        walker = walker,
        albumRepository = albumRepository,
    )

    // Wire Discogs sync service
    val syncService = buildSyncService(config, albumRepository, libraryRootPath)

    val tagWriteService = TagWriteService(albumRepository, trackRepository, libraryRootPath)

    // Run startup repair synchronously before accepting requests
    runBlocking { scanService.repairOnStartup() }

    attributes.put(ScanServiceKey, scanService)
    attributes.put(AlbumServiceKey, albumService)

    monitor.subscribe(ApplicationStopped) {
        dataSource.close()
    }

    configurePathTraversalGuard()
    configureLogging()
    configureSerialization()
    configureStatusPages()
    configureRouting(scanService, albumService, coverArtService, syncService, tagWriteService)

    // Launch initial library scan in the background after startup
    scanService.startScan()
}

private fun buildSyncService(
    config: AppConfig,
    albumRepository: ExposedAlbumRepository,
    libraryRootPath: Path,
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
    val imageQuota = DiscogsImageQuota()
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
