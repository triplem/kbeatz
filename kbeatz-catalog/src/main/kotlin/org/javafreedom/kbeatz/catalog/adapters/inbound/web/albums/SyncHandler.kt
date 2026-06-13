package org.javafreedom.kbeatz.catalog.adapters.inbound.web.albums

import io.github.oshai.kotlinlogging.KotlinLogging
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import java.nio.file.Path
import kotlin.coroutines.cancellation.CancellationException
import kotlin.uuid.Uuid
import org.javafreedom.kbeatz.catalog.api.models.Album as ApiAlbum
import org.javafreedom.kbeatz.catalog.api.models.ErrorResponse
import org.javafreedom.kbeatz.catalog.domain.model.Album
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
 * @param libraryRoot Used to compute relative [directoryPath] in API responses.
 * No auth in v1 (trusted LAN deployment).
 */
@Suppress("TooGenericExceptionCaught") // Ktor route must catch all errors to return structured responses
fun Route.syncRoutes(syncService: SyncProvider, libraryRoot: Path) {
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

internal fun Album.toSyncApiModel(libraryRoot: Path): ApiAlbum = ApiAlbum(
    id = id.toString(),
    albumArtist = albumArtist,
    album = album,
    albumPath = libraryRoot.relativize(Path.of(directoryPath)).toString(),
    directoryPath = libraryRoot.relativize(Path.of(directoryPath)).toString(),
    hasCoverArt = hasCoverArt,
    date = date,
    genre = genre,
    label = label,
    catalogNumber = catalogNumber,
    composer = composer,
    conductor = conductor,
    ensemble = ensemble,
    discogsId = discogsId,
)
