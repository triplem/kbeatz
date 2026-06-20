package org.javafreedom.kbeatz.catalog.adapters.inbound.web.albums

import io.ktor.http.*
import io.ktor.server.application.ApplicationCall
import io.ktor.server.response.*
import io.ktor.server.routing.*
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import kotlin.uuid.Uuid
import org.javafreedom.kbeatz.catalog.api.models.ErrorResponse
import org.javafreedom.kbeatz.catalog.application.service.CoverArtResult
import org.javafreedom.kbeatz.catalog.application.service.CoverArtService
import org.javafreedom.kbeatz.common.PathTraversalException
import org.javafreedom.kbeatz.common.ResourceNotFoundException

/**
 * Ktor route handler for `GET /albums/{albumId}/cover`.
 *
 * Resolution order (delegated to [CoverArtService]):
 * 1. Embedded METADATA_BLOCK_PICTURE type 3 in a FLAC track file.
 * 2. `folder.jpg` in the album directory.
 * 3. HTTP 404.
 *
 * A [PathTraversalException] from the service (path traversal) maps to HTTP 400.
 */
fun Route.coverArtRoutes(coverArtService: CoverArtService) {
    get("/albums/{albumId}/cover") {
        val albumIdRaw = call.parameters["albumId"]
        val albumId = albumIdRaw?.let { parseUuid(it) }

        when {
            albumIdRaw == null -> call.respond(
                HttpStatusCode.BadRequest,
                ErrorResponse(code = "INVALID_PARAMETER", message = "albumId is required"),
            )
            albumId == null -> call.respond(
                HttpStatusCode.BadRequest,
                ErrorResponse(code = "INVALID_PARAMETER", message = "albumId must be a valid UUID"),
            )
            else -> handleCoverArt(call, coverArtService, albumId, albumIdRaw)
        }
    }
}

private fun parseUuid(raw: String): Uuid? =
    try {
        Uuid.parse(raw)
    } catch (_: IllegalArgumentException) {
        null
    }

private suspend fun handleCoverArt(
    call: ApplicationCall,
    coverArtService: CoverArtService,
    albumId: Uuid,
    albumIdRaw: String,
) {
    when (val outcome = resolveCoverArt(coverArtService, albumId, albumIdRaw)) {
        is CoverArtOutcome.Found -> {
            call.response.headers.append(HttpHeaders.CacheControl, "public, max-age=86400")
            outcome.result.lastModified?.let { lastModified ->
                val httpDate = DateTimeFormatter.RFC_1123_DATE_TIME
                    .format(java.time.Instant.ofEpochMilli(lastModified.toEpochMilliseconds()).atOffset(ZoneOffset.UTC))
                call.response.headers.append(HttpHeaders.LastModified, httpDate)
            }
            call.respondBytes(
                bytes = outcome.result.bytes,
                contentType = ContentType.parse(outcome.result.mimeType),
            )
        }
        is CoverArtOutcome.NotFound -> call.respond(
            HttpStatusCode.NotFound,
            ErrorResponse(code = "RESOURCE_NOT_FOUND", message = outcome.message),
        )
        is CoverArtOutcome.BadRequest -> call.respond(
            HttpStatusCode.BadRequest,
            ErrorResponse(code = "INVALID_PATH", message = outcome.message),
        )
    }
}

private sealed class CoverArtOutcome {
    data class Found(val result: CoverArtResult) : CoverArtOutcome()
    data class NotFound(val message: String) : CoverArtOutcome()
    data class BadRequest(val message: String) : CoverArtOutcome()
}

@Suppress("TooGenericExceptionCaught") // mapping service exceptions to HTTP outcomes
private suspend fun resolveCoverArt(
    coverArtService: CoverArtService,
    albumId: Uuid,
    albumIdRaw: String,
): CoverArtOutcome =
    try {
        val result = coverArtService.getCoverArt(albumId)
        if (result != null) {
            CoverArtOutcome.Found(result)
        } else {
            CoverArtOutcome.NotFound("No cover art found for album '$albumIdRaw'")
        }
    } catch (_: PathTraversalException) {
        CoverArtOutcome.BadRequest("Album directory is outside the library root")
    } catch (_: ResourceNotFoundException) {
        CoverArtOutcome.NotFound("Album '$albumIdRaw' not found")
    }
