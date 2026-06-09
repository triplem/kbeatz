package org.javafreedom.kbeatz.catalog.adapters.inbound.web.health

import io.ktor.http.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import java.nio.file.Path
import org.javafreedom.kbeatz.catalog.api.models.ErrorResponse
import org.javafreedom.kbeatz.catalog.api.models.HealthResponse
import org.javafreedom.kbeatz.catalog.api.models.LivenessResponse
import org.javafreedom.kbeatz.catalog.api.models.ReadinessResponse

/**
 * Ktor route handlers for health probes.
 *
 * - GET /healthz - combined legacy probe (DB + filesystem), deprecated since K8s v1.16.
 * - GET /livez   - liveness probe: always 200 when the process is running.
 * - GET /readyz  - readiness probe: 200 when DB is reachable and startup repair is complete.
 *
 * @param dbProbe suspending function that returns true when the database is reachable.
 * @param repairReadyProbe function that returns true when the startup write-lock repair
 *   has completed. Returns 503 REPAIR_IN_PROGRESS until repair finishes.
 * @param libraryRoot filesystem path to the music library root.
 */
fun Route.healthRoutes(
    dbProbe: suspend () -> Boolean,
    libraryRoot: Path,
    repairReadyProbe: () -> Boolean = { true },
) {
    get("/healthz") {
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
    get("/livez") {
        call.respond(HttpStatusCode.OK, LivenessResponse(status = LivenessResponse.Status.UP))
    }

    // Readiness: 200 only when DB is up and startup repair has completed.
    get("/readyz") {
        val repairDone = repairReadyProbe()
        if (!repairDone) {
            call.respond(
                HttpStatusCode.ServiceUnavailable,
                ErrorResponse(code = "REPAIR_IN_PROGRESS", message = "Startup write-lock repair is running"),
            )
            return@get
        }
        val dbUp = runCatching { dbProbe() }.getOrDefault(false)
        if (dbUp) {
            call.respond(HttpStatusCode.OK, ReadinessResponse(status = ReadinessResponse.Status.UP))
        } else {
            call.respond(
                HttpStatusCode.ServiceUnavailable,
                ErrorResponse(code = "DATABASE_UNAVAILABLE", message = "Database is not reachable"),
            )
        }
    }
}
