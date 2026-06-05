package org.javafreedom.kbeatz.catalog.plugins

import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationPlugin
import io.ktor.server.application.createApplicationPlugin
import io.ktor.server.application.install
import io.ktor.server.request.uri
import io.ktor.server.response.respond
import org.javafreedom.kbeatz.catalog.api.models.ErrorResponse

val PathTraversalGuard: ApplicationPlugin<Unit> = createApplicationPlugin("PathTraversalGuard") {
    onCall { call ->
        val rawUri = call.request.uri
        // Decode percent-encoding (%2E%2E and similar variants)
        val decoded = try {
            java.net.URLDecoder.decode(rawUri, Charsets.UTF_8)
        } catch (_: IllegalArgumentException) {
            rawUri
        }
        if (rawUri.contains("..") || decoded.contains("..")) {
            call.respond(
                HttpStatusCode.BadRequest,
                ErrorResponse(code = "INVALID_PATH", message = "Path traversal detected")
            )
            return@onCall
        }
    }
}

fun Application.configurePathTraversalGuard() {
    install(PathTraversalGuard)
}
