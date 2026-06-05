package org.javafreedom.kbeatz.catalog.plugins

import io.ktor.server.application.*
import io.ktor.server.routing.*
import org.javafreedom.kbeatz.catalog.adapters.inbound.web.health.healthRoutes

fun Application.configureRouting() {
    routing {
        route("/api/v1") {
            healthRoutes()
        }
    }
}
