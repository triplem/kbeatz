package org.javafreedom.kbeatz.catalog.plugins

import io.ktor.server.application.*
import io.ktor.server.routing.*
import org.javafreedom.kbeatz.catalog.adapters.inbound.web.albums.albumDetailRoutes
import org.javafreedom.kbeatz.catalog.adapters.inbound.web.albums.albumRoutes
import org.javafreedom.kbeatz.catalog.adapters.inbound.web.albums.coverArtRoutes
import org.javafreedom.kbeatz.catalog.adapters.inbound.web.albums.syncRoutes
import org.javafreedom.kbeatz.catalog.adapters.inbound.web.health.healthRoutes
import org.javafreedom.kbeatz.catalog.adapters.inbound.web.library.libraryRoutes
import org.javafreedom.kbeatz.catalog.application.service.AlbumService
import org.javafreedom.kbeatz.catalog.application.service.CoverArtService
import org.javafreedom.kbeatz.catalog.application.service.DiscogsSyncService
import org.javafreedom.kbeatz.catalog.application.service.LibraryScanService

fun Application.configureRouting(
    scanService: LibraryScanService,
    albumService: AlbumService,
    coverArtService: CoverArtService,
    syncService: DiscogsSyncService,
) {
    routing {
        route("/api/v1") {
            healthRoutes()
            libraryRoutes(scanService)
            albumRoutes(albumService)
            albumDetailRoutes(albumService)
            coverArtRoutes(coverArtService)
            syncRoutes(syncService)
        }
    }
}
