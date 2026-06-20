package org.javafreedom.kbeatz.catalog.plugins

import io.github.oshai.kotlinlogging.KotlinLogging
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.plugins.callid.callId
import io.ktor.server.plugins.statuspages.*
import io.ktor.server.response.*
import org.javafreedom.kbeatz.catalog.api.models.ErrorResponse
import org.javafreedom.kbeatz.common.BusinessValidationException
import org.javafreedom.kbeatz.common.ConflictException
import org.javafreedom.kbeatz.common.PathTraversalException
import org.javafreedom.kbeatz.common.ResourceNotFoundException

private val logger = KotlinLogging.logger {}

fun Application.configureStatusPages() {
    install(StatusPages) {
        exception<ResourceNotFoundException> { call, _ ->
            val traceId = call.callId
            logger.debug { "Resource not found traceId=$traceId" }
            call.respond(
                HttpStatusCode.NotFound,
                ErrorResponse(code = "RESOURCE_NOT_FOUND", message = "Resource not found")
            )
        }
        exception<BusinessValidationException> { call, ex ->
            val traceId = call.callId
            logger.warn { "Business validation failed traceId=$traceId message=${ex.message}" }
            call.respond(
                HttpStatusCode.UnprocessableEntity,
                ErrorResponse(code = "VALIDATION_ERROR", message = ex.message ?: "Validation error")
            )
        }
        exception<PathTraversalException> { call, ex ->
            val traceId = call.callId
            logger.warn { "Path traversal rejected traceId=$traceId message=${ex.message}" }
            call.respond(
                HttpStatusCode.BadRequest,
                ErrorResponse(code = "INVALID_PATH", message = "Path is outside the library root")
            )
        }
        exception<ConflictException> { call, ex ->
            val traceId = call.callId
            logger.warn { "Write conflict traceId=$traceId message=${ex.message}" }
            call.respond(
                HttpStatusCode.Conflict,
                ErrorResponse(code = "WRITE_IN_PROGRESS", message = "Album write in progress, retry later")
            )
        }
        exception<Throwable> { call, ex ->
            val traceId = call.callId
            logger.error(ex) { "Unhandled exception traceId=$traceId" }
            call.respond(
                HttpStatusCode.InternalServerError,
                ErrorResponse(code = "INTERNAL_ERROR", message = "An unexpected error occurred")
            )
        }
    }
}
