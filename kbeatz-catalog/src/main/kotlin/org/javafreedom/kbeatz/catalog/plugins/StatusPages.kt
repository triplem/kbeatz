package org.javafreedom.kbeatz.catalog.plugins

import io.github.oshai.kotlinlogging.KotlinLogging
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.plugins.statuspages.*
import io.ktor.server.response.*
import org.javafreedom.kbeatz.catalog.api.models.ErrorResponse
import org.javafreedom.kbeatz.common.ResourceNotFoundException

private val logger = KotlinLogging.logger {}

fun Application.configureStatusPages() {
    install(StatusPages) {
        exception<ResourceNotFoundException> { call, ex ->
            call.respond(
                HttpStatusCode.NotFound,
                ErrorResponse(code = "RESOURCE_NOT_FOUND", message = ex.message ?: "Not found")
            )
        }
        exception<Throwable> { call, ex ->
            val traceId = call.attributes.getOrNull(TraceIdKey)
            logger.error(ex) { "Unhandled exception traceId=$traceId" }
            call.respond(
                HttpStatusCode.InternalServerError,
                ErrorResponse(code = "INTERNAL_ERROR", message = "An unexpected error occurred")
            )
        }
    }
}
