package org.javafreedom.kbeatz.catalog.adapters.inbound.web.albums

import io.github.oshai.kotlinlogging.KotlinLogging
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import java.nio.file.Path
import kotlin.coroutines.cancellation.CancellationException
import kotlin.time.Clock
import kotlin.time.Instant
import kotlin.uuid.Uuid
import org.javafreedom.kbeatz.catalog.api.models.Album as ApiAlbum
import org.javafreedom.kbeatz.catalog.api.models.ErrorResponse
import org.javafreedom.kbeatz.catalog.api.models.SyncFieldChange as ApiSyncFieldChange
import org.javafreedom.kbeatz.catalog.api.models.SyncPreviewResponse
import org.javafreedom.kbeatz.catalog.domain.model.Album
import org.javafreedom.kbeatz.catalog.domain.model.SyncPreview
import org.javafreedom.kbeatz.catalog.domain.port.SyncProvider
import org.javafreedom.kbeatz.common.BusinessValidationException
import org.javafreedom.kbeatz.common.ImageQuotaExhaustedException
import org.javafreedom.kbeatz.common.ResourceNotFoundException

private val log = KotlinLogging.logger {}

/**
 * Ktor route handler for `POST /albums/{albumId}/sync`.
 *
 * Triggers a metadata sync for the specified album via the configured [SyncProvider].
 * Delegates all business logic to the provider.
 *
 * ## Response codes
 * - 200: sync completed successfully; returns updated [ApiAlbum]
 * - 400: invalid UUID in path or malformed release ID stored in the database
 * - 404: album not found
 * - 422: album has no source ID - cannot sync
 * - 429: image quota exhausted (only when `downloadImages=true`)
 * - 503: provider API unavailable (network error)
 *
 * @param libraryRoot Used to compute relative [albumPath] in API responses.
 * No auth in v1 (trusted LAN deployment).
 */
@Suppress("TooGenericExceptionCaught") // Ktor route must catch all errors to return structured responses
fun Route.syncRoutes(syncService: SyncProvider, libraryRoot: Path) {
    get("/albums/{albumId}/sync/preview") {
        val albumIdStr = call.parameters["albumId"]
        val albumId = albumIdStr?.let { runCatching { Uuid.parse(it) }.getOrNull() }

        when {
            albumIdStr == null -> call.respond(
                HttpStatusCode.BadRequest,
                ErrorResponse(code = "INVALID_ALBUM_ID", message = "Missing albumId parameter"),
            )
            albumId == null -> call.respond(
                HttpStatusCode.BadRequest,
                ErrorResponse(code = "INVALID_ALBUM_ID", message = "Invalid UUID: $albumIdStr"),
            )
            else -> handlePreview(call, syncService, albumId)
        }
    }

    post("/albums/{albumId}/sync") {
        val albumIdStr = call.parameters["albumId"]
        val albumId = albumIdStr?.let { runCatching { Uuid.parse(it) }.getOrNull() }

        when {
            albumIdStr == null -> call.respond(
                HttpStatusCode.BadRequest,
                ErrorResponse(code = "INVALID_ALBUM_ID", message = "Missing albumId parameter"),
            )
            albumId == null -> call.respond(
                HttpStatusCode.BadRequest,
                ErrorResponse(code = "INVALID_ALBUM_ID", message = "Invalid UUID: $albumIdStr"),
            )
            else -> handleSync(call, syncService, albumId, libraryRoot)
        }
    }
}

@Suppress("TooGenericExceptionCaught") // catch-all for network/codec errors -> 503
private suspend fun handlePreview(
    call: ApplicationCall,
    syncService: SyncProvider,
    albumId: Uuid,
) {
    try {
        val preview = syncService.preview(albumId)
        call.respond(HttpStatusCode.OK, preview.toApiModel())
    } catch (ex: ResourceNotFoundException) {
        call.respond(
            HttpStatusCode.NotFound,
            ErrorResponse(code = "RESOURCE_NOT_FOUND", message = ex.message ?: "Album not found"),
        )
    } catch (ex: BusinessValidationException) {
        call.respond(
            HttpStatusCode.UnprocessableEntity,
            ErrorResponse(code = "NO_SOURCE_ID", message = ex.message ?: "No source ID"),
        )
    } catch (ex: CancellationException) {
        throw ex
    } catch (ex: Exception) {
        log.error(ex) { "Sync preview failed albumId=$albumId provider=${syncService.name}" }
        call.respond(
            HttpStatusCode.ServiceUnavailable,
            ErrorResponse(code = "PREVIEW_FAILED", message = "Sync preview failed - check server logs for details"),
        )
    }
}

@Suppress("TooGenericExceptionCaught") // catch-all for network/codec errors -> 503
private suspend fun handleSync(
    call: ApplicationCall,
    syncService: SyncProvider,
    albumId: Uuid,
    libraryRoot: Path,
) {
    val downloadImages = call.receiveNullable<Map<String, Boolean>>()?.get("downloadImages") ?: false
    try {
        val result = syncService.sync(albumId, downloadImages)
        call.respond(HttpStatusCode.OK, result.updatedAlbum.toSyncApiModel(libraryRoot))
    } catch (ex: ResourceNotFoundException) {
        call.respond(HttpStatusCode.NotFound,
            ErrorResponse(code = "RESOURCE_NOT_FOUND", message = ex.message ?: "Album not found"))
    } catch (ex: BusinessValidationException) {
        call.respond(HttpStatusCode.UnprocessableEntity,
            ErrorResponse(code = "NO_SOURCE_ID", message = ex.message ?: "No source ID"))
    } catch (ex: ImageQuotaExhaustedException) {
        call.response.headers.append(HttpHeaders.RetryAfter, computeRetryAfterSeconds(ex.resetAt).toString())
        call.respond(HttpStatusCode.TooManyRequests,
            ErrorResponse(
                code = "IMAGE_QUOTA_EXHAUSTED",
                message = ex.message ?: "Daily image quota exhausted",
                details = listOf("resetAt=${ex.resetAt}"),
            ))
    } catch (ex: IllegalArgumentException) {
        call.respond(HttpStatusCode.BadRequest,
            ErrorResponse(code = "INVALID_RELEASE_ID", message = ex.message ?: "Invalid release ID"))
    } catch (ex: CancellationException) {
        throw ex
    } catch (ex: Exception) {
        log.error(ex) { "Sync failed albumId=$albumId provider=${syncService.name}" }
        call.respond(HttpStatusCode.ServiceUnavailable,
            ErrorResponse(code = "SYNC_FAILED", message = "Sync failed - check server logs for details"))
    }
}

internal fun SyncPreview.toApiModel(): SyncPreviewResponse = SyncPreviewResponse(
    albumId = albumId.toString(),
    proposedChanges = proposedChanges.map { change ->
        ApiSyncFieldChange(
            field = change.field,
            currentValue = change.currentValue,  // empty string when field is not currently set
            proposedValue = change.proposedValue,
        )
    },
)

/**
 * Computes the number of whole seconds until the quota reset time described by [resetAt].
 *
 * [resetAt] is an ISO 8601 UTC timestamp produced by [DiscogsImageService] (e.g. "2026-06-19T00:00:00Z").
 * If parsing fails or the reset time is already in the past, falls back to [RETRY_AFTER_FALLBACK_SECONDS]
 * so the response always carries a valid, non-negative Retry-After value.
 */
@Suppress("TooGenericExceptionCaught") // any parse error must not suppress the 429 response
internal fun computeRetryAfterSeconds(resetAt: String, clock: Clock = Clock.System): Long {
    val secondsRemaining = runCatching {
        val resetInstant = Instant.parse(resetAt)
        val nowInstant = clock.now()
        (resetInstant - nowInstant).inWholeSeconds
    }.getOrDefault(RETRY_AFTER_FALLBACK_SECONDS)
    return maxOf(secondsRemaining, 0L)
}

@Suppress("MagicNumber") // 3600 seconds = 1 hour fallback when resetAt cannot be parsed
internal const val RETRY_AFTER_FALLBACK_SECONDS = 3600L

internal fun Album.toSyncApiModel(libraryRoot: Path): ApiAlbum = ApiAlbum(
    id = id.toString(),
    albumArtist = albumArtist,
    album = album,
    albumPath = libraryRoot.relativize(Path.of(directoryPath)).toString(),
    hasCoverArt = hasCoverArt,
    date = date,
    genre = genre,
    label = label,
    catalogNumber = catalogNumber,
    composer = composer,
    conductor = conductor,
    ensemble = ensemble,
    country = country,
    mediaFormat = mediaFormat,
    discogsId = discogsId,
)
