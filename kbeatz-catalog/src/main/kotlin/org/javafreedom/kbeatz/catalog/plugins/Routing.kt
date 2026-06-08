package org.javafreedom.kbeatz.catalog.plugins

import io.ktor.server.application.*
import io.ktor.server.routing.*
import org.javafreedom.kbeatz.catalog.adapters.inbound.web.albums.albumDetailRoutes
import org.javafreedom.kbeatz.catalog.adapters.inbound.web.albums.albumRoutes
import org.javafreedom.kbeatz.catalog.adapters.inbound.web.albums.coverArtRoutes
import org.javafreedom.kbeatz.catalog.adapters.inbound.web.albums.syncRoutes
import org.javafreedom.kbeatz.catalog.adapters.inbound.web.albums.tagRoutes
import org.javafreedom.kbeatz.catalog.adapters.inbound.web.health.HealthConfig
import org.javafreedom.kbeatz.catalog.adapters.inbound.web.health.healthRoutes
import org.javafreedom.kbeatz.catalog.adapters.inbound.web.library.libraryRoutes
import org.javafreedom.kbeatz.catalog.application.service.AlbumService
import org.javafreedom.kbeatz.catalog.application.service.CoverArtService
import org.javafreedom.kbeatz.catalog.application.service.LibraryScanService
import org.javafreedom.kbeatz.catalog.application.service.TagWriteService
import org.javafreedom.kbeatz.catalog.domain.port.SyncProvider

@Suppress("LongParameterList") // wiring function - all parameters are service/config dependencies
fun Application.configureRouting(
    scanService: LibraryScanService,
    albumService: AlbumService,
    coverArtService: CoverArtService,
    syncService: SyncProvider,
    tagWriteService: TagWriteService,
    healthConfig: HealthConfig,
) {
    routing {
        // Health probes at root level per K8s convention (/livez, /readyz, /healthz)
        healthRoutes(healthConfig.dbProbe, healthConfig.libraryRoot)
        route("/api/v1") {
            libraryRoutes(scanService)
            albumRoutes(albumService, healthConfig.libraryRoot)
            albumDetailRoutes(albumService, healthConfig.libraryRoot)
            tagRoutes(albumService, tagWriteService, healthConfig.libraryRoot)
            coverArtRoutes(coverArtService)
            syncRoutes(syncService, healthConfig.libraryRoot)
        }
    }
}
