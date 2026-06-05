package org.javafreedom.kbeatz.catalog.adapters.inbound.web.health

import io.ktor.http.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.javafreedom.kbeatz.catalog.api.models.HealthResponse

fun Route.healthRoutes() {
    get("/health") {
        call.respond(HttpStatusCode.OK, HealthResponse(status = HealthResponse.Status.UP))
    }
}
