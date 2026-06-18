package org.javafreedom.kbeatz.catalog.adapters.inbound.web.albums

import io.ktor.http.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import java.nio.file.Path
import kotlin.math.ceil
import org.javafreedom.kbeatz.catalog.api.models.Album as ApiAlbum
import org.javafreedom.kbeatz.catalog.api.models.AlbumPage
import org.javafreedom.kbeatz.catalog.application.service.AlbumService
import org.javafreedom.kbeatz.catalog.domain.model.Album
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumFilter

/**
 * Ktor route handlers for album browsing.
 *
 * `GET /albums` supports optional `page`, `size`, `q`, `albumArtist`, `composer`,
 * `genre`, `yearFrom`, and `yearTo` query parameters. All filter parameters are
 * applied server-side. Results are always wrapped in an [AlbumPage] pagination envelope.
 *
 * @param libraryRoot Used to compute relative [albumPath] in API responses.
 * No auth in v1 (trusted LAN deployment).
 */
fun Route.albumRoutes(albumService: AlbumService, libraryRoot: Path) {
    get("/albums") {
        val params = call.request.queryParameters
        val page = params["page"]?.toIntOrNull()?.coerceAtLeast(0) ?: 0
        val size = params["size"]?.toIntOrNull()
            ?.coerceIn(1, MAX_PAGE_SIZE) ?: DEFAULT_PAGE_SIZE

        val filter = AlbumFilter(
            q = params["q"]?.takeIf { it.isNotBlank() },
            albumArtist = params["albumArtist"]?.takeIf { it.isNotBlank() },
            composer = params["composer"]?.takeIf { it.isNotBlank() },
            genre = params["genre"]?.takeIf { it.isNotBlank() },
            yearFrom = params["yearFrom"]?.toIntOrNull(),
            yearTo = params["yearTo"]?.toIntOrNull(),
        )

        val (albums, total) = albumService.listAlbums(page, size, filter)
        val totalPages = if (total == 0L) 0 else ceil(total.toDouble() / size).toInt()

        call.respond(
            HttpStatusCode.OK,
            AlbumPage(
                content = albums.map { it.toApiModel(libraryRoot) },
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

internal fun Album.toApiModel(libraryRoot: Path): ApiAlbum = ApiAlbum(
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
    trackCount = trackCount,
    totalDurationSeconds = totalDurationSeconds,
)
