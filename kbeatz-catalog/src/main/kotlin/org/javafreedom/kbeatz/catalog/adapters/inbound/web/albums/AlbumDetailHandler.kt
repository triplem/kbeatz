package org.javafreedom.kbeatz.catalog.adapters.inbound.web.albums

import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import java.nio.file.Path
import kotlin.uuid.Uuid
import org.javafreedom.kbeatz.catalog.api.models.AlbumDetail
import org.javafreedom.kbeatz.catalog.api.models.ErrorResponse
import org.javafreedom.kbeatz.catalog.api.models.Track as ApiTrack
import org.javafreedom.kbeatz.catalog.application.service.AlbumService
import org.javafreedom.kbeatz.catalog.domain.model.Album
import org.javafreedom.kbeatz.catalog.domain.model.Track

/**
 * Ktor route handler for `GET /albums/{albumId}`.
 *
 * Returns an [AlbumDetail] with all Vorbis Comment tag fields and a list of tracks.
 * The albumId path parameter is a UUID - it is resolved to a filesystem path via the
 * database only; no direct path exposure in the URL (path traversal guard satisfied).
 *
 * ## Response codes
 * - 200: album found; body is [AlbumDetail]
 * - 400: albumId is not a valid UUID
 * - 404: album not found in H2 index
 *
 * @param libraryRoot Used to compute relative [directoryPath] in API responses.
 * No auth in v1 (trusted LAN deployment).
 */
fun Route.albumDetailRoutes(albumService: AlbumService, libraryRoot: Path) {
    get("/albums/{albumId}") {
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
            else -> handleGetAlbum(call, albumService, albumId, libraryRoot)
        }
    }
}

private suspend fun handleGetAlbum(
    call: ApplicationCall,
    albumService: AlbumService,
    albumId: Uuid,
    libraryRoot: Path,
) {
    val (album, tracks) = albumService.getAlbumWithTracks(albumId)
    call.respond(HttpStatusCode.OK, album.toDetailApiModel(tracks, libraryRoot))
}

internal fun Album.toDetailApiModel(tracks: List<Track>, libraryRoot: Path): AlbumDetail = AlbumDetail(
    id = id.toString(),
    albumArtist = albumArtist,
    album = album,
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
    tracks = tracks.map { it.toApiModel() },
)

private fun Track.toApiModel(): ApiTrack = ApiTrack(
    id = id.toString(),
    albumId = albumId.toString(),
    path = path,
    title = title,
    trackNumber = trackNumber,
    discNumber = discNumber,
    artist = artist,
    composer = composer,
    conductor = conductor,
    ensemble = ensemble,
    durationSeconds = durationSeconds,
)
