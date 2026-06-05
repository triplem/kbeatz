package org.javafreedom.kbeatz.catalog.plugins

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.plugins.statuspages.*
import io.ktor.server.response.*
import org.javafreedom.kbeatz.catalog.api.models.ErrorResponse
import org.javafreedom.kbeatz.common.ResourceNotFoundException

fun Application.configureStatusPages() {
    install(StatusPages) {
        exception<ResourceNotFoundException> { call, ex ->
            call.respond(
                HttpStatusCode.NotFound,
                ErrorResponse(code = "RESOURCE_NOT_FOUND", message = ex.message ?: "Not found")
            )
        }
        exception<Throwable> { call, _ ->
            call.respond(
                HttpStatusCode.InternalServerError,
                ErrorResponse(code = "INTERNAL_ERROR", message = "An unexpected error occurred")
            )
        }
    }
}
