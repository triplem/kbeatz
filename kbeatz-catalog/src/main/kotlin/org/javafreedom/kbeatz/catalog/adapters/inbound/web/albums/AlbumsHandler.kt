package org.javafreedom.kbeatz.catalog.adapters.inbound.web.albums

import io.ktor.http.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlin.math.ceil
import org.javafreedom.kbeatz.catalog.api.models.Album as ApiAlbum
import org.javafreedom.kbeatz.catalog.api.models.AlbumPage
import org.javafreedom.kbeatz.catalog.application.service.AlbumService
import org.javafreedom.kbeatz.catalog.domain.model.Album

/**
 * Ktor route handlers for album browsing.
 *
 * `GET /albums` supports optional `page` and `size` parameters.
 * Results are always wrapped in an [AlbumPage] pagination envelope.
 *
 * No auth in v1 (trusted LAN deployment).
 */
fun Route.albumRoutes(albumService: AlbumService) {
    get("/albums") {
        val page = call.request.queryParameters["page"]?.toIntOrNull()?.coerceAtLeast(0) ?: 0
        val size = call.request.queryParameters["size"]?.toIntOrNull()
            ?.coerceIn(1, MAX_PAGE_SIZE) ?: DEFAULT_PAGE_SIZE

        val (albums, total) = albumService.listAlbums(page, size)
        val totalPages = if (total == 0L) 0 else ceil(total.toDouble() / size).toInt()

        call.respond(
            HttpStatusCode.OK,
            AlbumPage(
                content = albums.map { it.toApiModel() },
                page = page,
                propertySize = size,
                totalElements = total,
                totalPages = totalPages,
            ),
        )
    }
}

private const val DEFAULT_PAGE_SIZE = 20
private const val MAX_PAGE_SIZE = 100

private fun Album.toApiModel(): ApiAlbum = ApiAlbum(
    id = id.toString(),
    albumArtist = albumArtist,
    album = album,
    directoryPath = directoryPath,
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
