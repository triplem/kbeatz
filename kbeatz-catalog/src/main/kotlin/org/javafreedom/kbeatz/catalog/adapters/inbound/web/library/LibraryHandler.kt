package org.javafreedom.kbeatz.catalog.adapters.inbound.web.library

import io.ktor.http.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.javafreedom.kbeatz.catalog.api.models.ScanStatus as ApiScanStatus
import org.javafreedom.kbeatz.catalog.application.service.LibraryScanService
import org.javafreedom.kbeatz.catalog.domain.model.ScanState
import org.javafreedom.kbeatz.catalog.domain.model.ScanStatus

/**
 * Ktor route handlers for library scan operations.
 *
 * Maps between the domain [ScanStatus]/[ScanState] model and the generated
 * OpenAPI [ApiScanStatus] response type.
 *
 * No auth in v1 (trusted LAN deployment).
 */
fun Route.libraryRoutes(scanService: LibraryScanService) {
    post("/library/scan") {
        scanService.startScan()
        val status = scanService.status()
        call.respond(HttpStatusCode.Accepted, status.toApiModel())
    }

    get("/library/scan/status") {
        val status = scanService.status()
        call.respond(HttpStatusCode.OK, status.toApiModel())
    }
}

private fun ScanStatus.toApiModel(): ApiScanStatus = ApiScanStatus(
    state = state.toApiState(),
    scannedAlbums = scannedAlbums.toInt(),
    totalAlbums = totalAlbums.toInt(),
    startedAt = null,   // startedAt timestamp tracking deferred to a follow-up story
    completedAt = null, // completedAt timestamp tracking deferred to a follow-up story
    errorMessage = errorMessage,
)

private fun ScanState.toApiState(): ApiScanStatus.State = when (this) {
    ScanState.IDLE -> ApiScanStatus.State.IDLE
    ScanState.RUNNING -> ApiScanStatus.State.RUNNING
    ScanState.COMPLETE -> ApiScanStatus.State.COMPLETED
    ScanState.FAILED -> ApiScanStatus.State.FAILED
}
