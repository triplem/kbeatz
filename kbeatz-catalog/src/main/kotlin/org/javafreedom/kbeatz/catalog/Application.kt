package org.javafreedom.kbeatz.catalog

import io.ktor.server.application.*
import io.ktor.server.cio.*
import io.ktor.server.engine.*
import io.ktor.util.AttributeKey
import java.nio.file.Path
import kotlinx.coroutines.runBlocking
import org.javafreedom.kbeatz.catalog.application.service.AlbumService
import org.javafreedom.kbeatz.catalog.application.service.CoverArtService
import org.javafreedom.kbeatz.catalog.application.service.LibraryScanService
import org.javafreedom.kbeatz.catalog.application.service.LibraryWalker
import org.javafreedom.kbeatz.catalog.infrastructure.persistence.DbFactory
import org.javafreedom.kbeatz.catalog.infrastructure.persistence.ExposedAlbumRepository
import org.javafreedom.kbeatz.catalog.plugins.configureLogging
import org.javafreedom.kbeatz.catalog.plugins.configurePathTraversalGuard
import org.javafreedom.kbeatz.catalog.plugins.configureRouting
import org.javafreedom.kbeatz.catalog.plugins.configureSerialization
import org.javafreedom.kbeatz.catalog.plugins.configureStatusPages

val AppConfigKey = AttributeKey<AppConfig>("AppConfig")
val ScanServiceKey = AttributeKey<LibraryScanService>("LibraryScanService")
val AlbumServiceKey = AttributeKey<AlbumService>("AlbumService")

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
    val albumService = AlbumService(albumRepository)
    val libraryRootPath = Path.of(config.catalogLibraryRoot)
    val coverArtService = CoverArtService(albumRepository, libraryRootPath)
    val walker = LibraryWalker()
    val scanService = LibraryScanService(
        libraryRoot = libraryRootPath,
        walker = walker,
        albumRepository = albumRepository,
    )

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
    configureRouting(scanService, albumService, coverArtService)

    // Launch initial library scan in the background after startup
    scanService.startScan()
}
