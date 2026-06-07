package org.javafreedom.kbeatz.catalog.adapters.inbound.web.health

import io.ktor.http.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import java.nio.file.Path
import org.javafreedom.kbeatz.catalog.api.models.HealthResponse

/**
 * Ktor route handler for `GET /health`.
 *
 * Performs a lightweight DB connectivity probe and filesystem root check.
 * Returns 200 UP when both are healthy; 503 DOWN with per-component detail otherwise.
 *
 * @param dbProbe Suspending function that returns true when the database is reachable.
 * @param libraryRoot Filesystem path to the music library root.
 */
fun Route.healthRoutes(
    dbProbe: suspend () -> Boolean,
    libraryRoot: Path,
) {
    get("/health") {
        val dbUp = runCatching { dbProbe() }.getOrDefault(false)
        val fsUp = libraryRoot.toFile().exists()
        val allUp = dbUp && fsUp
        val status = if (allUp) HealthResponse.Status.UP else HealthResponse.Status.DOWN
        val code = if (allUp) HttpStatusCode.OK else HttpStatusCode.ServiceUnavailable
        call.respond(
            code,
            HealthResponse(
                status = status,
                details = mapOf(
                    "database" to if (dbUp) "UP" else "DOWN",
                    "filesystem" to if (fsUp) "UP" else "DOWN",
                ),
            ),
        )
    }
}
