package org.javafreedom.kbeatz.catalog.adapters.inbound.web.albums

import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.patch
import java.nio.file.Path
import kotlin.uuid.Uuid
import org.javafreedom.kbeatz.catalog.api.models.BulkUpdateTagsRequest
import org.javafreedom.kbeatz.catalog.api.models.AlbumDetail
import org.javafreedom.kbeatz.catalog.api.models.ErrorResponse
import org.javafreedom.kbeatz.catalog.api.models.UpdateTagFieldRequest
import org.javafreedom.kbeatz.catalog.application.service.AlbumService
import org.javafreedom.kbeatz.catalog.application.service.TagWriteService
import org.javafreedom.kbeatz.catalog.domain.model.Album
import org.javafreedom.kbeatz.catalog.domain.model.Track
import org.javafreedom.kbeatz.common.ConflictException
import org.javafreedom.kbeatz.common.ResourceNotFoundException

/**
 * Ktor route handlers for tag editing endpoints.
 *
 * `PATCH /albums/{albumId}` — writes a single album-level Vorbis Comment field to all FLAC files.
 * `PATCH /albums/{albumId}/tags` — bulk-writes multiple album and track fields in one request.
 * `PATCH /albums/{albumId}/tracks/{trackId}` — writes a single track-level field to one FLAC file.
 *
 * Both single-field endpoints accept `{field, value}` and return the updated [AlbumDetail] on 200.
 * The bulk endpoint accepts a [BulkUpdateTagsRequest] and returns the updated [AlbumDetail] on 200.
 * Field names are case-insensitive (normalised to uppercase before validation).
 *
 * ## Response codes
 * - 200: tag written; returns updated [AlbumDetail]
 * - 400: invalid UUID, missing parameter, or unknown field name
 * - 404: album or track not found
 * - 409: write lock conflict (CLI is concurrently writing)
 *
 * No auth in v1 (trusted LAN deployment).
 */
@Suppress("TooGenericExceptionCaught") // route handlers must return structured error responses
fun Route.tagRoutes(albumService: AlbumService, tagWriteService: TagWriteService, libraryRoot: Path) {
    patch("/albums/{albumId}") {
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
            else -> handlePatchAlbum(call, albumId, albumService, tagWriteService, libraryRoot)
        }
    }

    patch("/albums/{albumId}/tags") {
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
            else -> handleBulkPatch(call, albumId, albumService, tagWriteService, libraryRoot)
        }
    }

    patch("/albums/{albumId}/tracks/{trackId}") {
        val albumIdStr = call.parameters["albumId"]
        val trackIdStr = call.parameters["trackId"]
        val albumId = albumIdStr?.let { runCatching { Uuid.parse(it) }.getOrNull() }
        val trackId = trackIdStr?.let { runCatching { Uuid.parse(it) }.getOrNull() }

        when {
            albumIdStr == null || albumId == null -> call.respond(
                HttpStatusCode.BadRequest,
                ErrorResponse(code = "INVALID_ALBUM_ID", message = "Invalid albumId"),
            )
            trackIdStr == null || trackId == null -> call.respond(
                HttpStatusCode.BadRequest,
                ErrorResponse(code = "INVALID_TRACK_ID", message = "Invalid trackId"),
            )
            else -> handlePatchTrack(call, albumId, trackId, albumService, tagWriteService, libraryRoot)
        }
    }
}

private suspend fun handlePatchAlbum(
    call: ApplicationCall,
    albumId: Uuid,
    albumService: AlbumService,
    tagWriteService: TagWriteService,
    libraryRoot: Path,
) {
    try {
        val request = call.receive<UpdateTagFieldRequest>()
        // Write returns updated Album; reload tracks separately for the AlbumDetail response
        val updatedAlbum = tagWriteService.writeAlbumTags(albumId, request.field, request.value)
        val (_, tracks) = albumService.getAlbumWithTracks(albumId)
        call.respond(HttpStatusCode.OK, updatedAlbum.toDetailApiModel(tracks, libraryRoot))
    } catch (ex: ResourceNotFoundException) {
        call.respond(
            HttpStatusCode.NotFound,
            ErrorResponse(code = "RESOURCE_NOT_FOUND", message = ex.message ?: "Album not found"),
        )
    } catch (ex: IllegalArgumentException) {
        call.respond(
            HttpStatusCode.BadRequest,
            ErrorResponse(code = "INVALID_FIELD", message = ex.message ?: "Invalid field"),
        )
    } catch (_: SecurityException) {
        call.respond(
            HttpStatusCode.BadRequest,
            ErrorResponse(code = "INVALID_PATH", message = "Album path is outside the library root"),
        )
    }
}

@Suppress("LongParameterList") // private route handler — call + IDs + services + config
private suspend fun handlePatchTrack(
    call: ApplicationCall,
    albumId: Uuid,
    trackId: Uuid,
    albumService: AlbumService,
    tagWriteService: TagWriteService,
    libraryRoot: Path,
) {
    try {
        val request = call.receive<UpdateTagFieldRequest>()
        tagWriteService.writeTrackTags(albumId, trackId, request.field, request.value)
        val (album, tracks) = albumService.getAlbumWithTracks(albumId)
        call.respond(HttpStatusCode.OK, album.toDetailApiModel(tracks, libraryRoot))
    } catch (ex: ResourceNotFoundException) {
        call.respond(
            HttpStatusCode.NotFound,
            ErrorResponse(code = "RESOURCE_NOT_FOUND", message = ex.message ?: "Not found"),
        )
    } catch (ex: IllegalArgumentException) {
        call.respond(
            HttpStatusCode.BadRequest,
            ErrorResponse(code = "INVALID_FIELD", message = ex.message ?: "Invalid field"),
        )
    } catch (_: SecurityException) {
        call.respond(
            HttpStatusCode.BadRequest,
            ErrorResponse(code = "INVALID_PATH", message = "Album path is outside the library root"),
        )
    }
}

private suspend fun handleBulkPatch(
    call: ApplicationCall,
    albumId: Uuid,
    albumService: AlbumService,
    tagWriteService: TagWriteService,
    libraryRoot: Path,
) {
    try {
        val request = call.receive<BulkUpdateTagsRequest>()
        val albumFields = (request.albumFields ?: emptyList()).map { it.field to it.value }
        val trackFields = (request.trackFields ?: emptyList()).map { update ->
            val trackId = runCatching { Uuid.parse(update.trackId) }.getOrElse {
                call.respond(
                    HttpStatusCode.BadRequest,
                    ErrorResponse(code = "INVALID_TRACK_ID", message = "Invalid track UUID in trackFields"),
                )
                return
            }
            Triple(trackId, update.field, update.value)
        }
        val updatedAlbum = tagWriteService.writeBulkTags(albumId, albumFields, trackFields)
        val (_, tracks) = albumService.getAlbumWithTracks(albumId)
        call.respond(HttpStatusCode.OK, updatedAlbum.toDetailApiModel(tracks, libraryRoot))
    } catch (ex: ResourceNotFoundException) {
        call.respond(
            HttpStatusCode.NotFound,
            ErrorResponse(code = "RESOURCE_NOT_FOUND", message = ex.message ?: "Not found"),
        )
    } catch (ex: IllegalArgumentException) {
        call.respond(
            HttpStatusCode.BadRequest,
            ErrorResponse(code = "INVALID_FIELD", message = ex.message ?: "Invalid field"),
        )
    } catch (ex: ConflictException) {
        call.respond(
            HttpStatusCode.Conflict,
            ErrorResponse(code = "WRITE_CONFLICT", message = ex.message ?: "Write conflict"),
        )
    } catch (_: SecurityException) {
        call.respond(
            HttpStatusCode.BadRequest,
            ErrorResponse(code = "INVALID_PATH", message = "Album path is outside the library root"),
        )
    }
}

// Note: toDetailApiModel() is defined in AlbumDetailHandler.kt and used here via package visibility.
