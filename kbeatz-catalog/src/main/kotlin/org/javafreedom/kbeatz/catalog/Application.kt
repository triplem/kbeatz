package org.javafreedom.kbeatz.catalog

import io.ktor.server.application.*
import io.ktor.server.cio.*
import io.ktor.server.engine.*
import io.ktor.util.AttributeKey
import java.nio.file.Files
import java.nio.file.Path
import kotlinx.coroutines.runBlocking
import org.javafreedom.kbeatz.catalog.adapters.inbound.web.health.HealthConfig
import org.javafreedom.kbeatz.catalog.application.service.AlbumService
import org.javafreedom.kbeatz.catalog.application.service.LibraryScanService
import org.javafreedom.kbeatz.catalog.plugins.configureLogging
import org.javafreedom.kbeatz.catalog.plugins.configurePathTraversalGuard
import org.javafreedom.kbeatz.catalog.plugins.configureRequestBodySizeLimit
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
    val config = AppConfig.fromConf()
    attributes.put(AppConfigKey, config)

    val libraryRootPath = Path.of(config.catalogLibraryRoot)

    // Ensure runtime data directory exists (quota file, etc.)
    val dataDirPath = Path.of(config.dataDir)
    Files.createDirectories(dataDirPath)

    // Wire all outbound adapters and construct services via DependencyContainer
    val deps = DependencyContainer(config, libraryRootPath, dataDirPath)

    // Run startup repair synchronously before accepting requests. Move-journal recovery runs in the
    // same phase (before traffic) so no album is left in a partially-applied move state (issue #814).
    runBlocking {
        deps.directoryMoveRecovery.recoverInterruptedMoves()
        deps.scanService.repairOnStartup()
    }

    attributes.put(ScanServiceKey, deps.scanService)
    attributes.put(AlbumServiceKey, deps.albumService)

    monitor.subscribe(ApplicationStopped) {
        deps.scanService.close()
        deps.dataSource.close()
    }

    val healthConfig = HealthConfig(
        dbProbe = deps.dbProbe,
        repairReadyProbe = deps.scanService::isRepairComplete,
        libraryRoot = libraryRootPath,
    )

    configurePathTraversalGuard()
    configureRequestBodySizeLimit()
    configureLogging()
    configureSerialization()
    configureStatusPages()
    configureRouting(
        deps.scanService,
        deps.albumService,
        deps.coverArtService,
        deps.syncService,
        deps.tagWriteService,
        healthConfig,
    )

    // Launch initial library scan in the background after startup
    deps.scanService.startScan()
}
