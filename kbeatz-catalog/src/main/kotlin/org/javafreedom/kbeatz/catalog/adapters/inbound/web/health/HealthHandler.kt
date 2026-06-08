package org.javafreedom.kbeatz.catalog.adapters.inbound.web.health

import io.ktor.http.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import java.nio.file.Path
import org.javafreedom.kbeatz.catalog.api.models.ErrorResponse
import org.javafreedom.kbeatz.catalog.api.models.HealthResponse
import org.javafreedom.kbeatz.catalog.api.models.LivenessResponse

/**
 * Ktor route handlers for health probes.
 *
 * - GET /health      - combined legacy probe (DB + filesystem).
 * - GET /health/live - liveness probe: always 200 when the process is running.
 * - GET /health/ready - readiness probe: 200 when DB is reachable, 503 when not.
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

    // Liveness: always 200 - no I/O, just confirms the process is alive.
    get("/health/live") {
        call.respond(HttpStatusCode.OK, LivenessResponse(status = LivenessResponse.Status.UP))
    }

    // Readiness: 200 when DB is up, 503 with ErrorResponse when DB is down.
    get("/health/ready") {
        val dbUp = runCatching { dbProbe() }.getOrDefault(false)
        if (dbUp) {
            call.respond(HttpStatusCode.OK, LivenessResponse(status = LivenessResponse.Status.UP))
        } else {
            call.respond(
                HttpStatusCode.ServiceUnavailable,
                ErrorResponse(code = "DATABASE_UNAVAILABLE", message = "Database is not reachable"),
            )
        }
    }
}
