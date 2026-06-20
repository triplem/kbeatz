package org.javafreedom.kbeatz.catalog.adapters.inbound.web.settings

import io.github.oshai.kotlinlogging.KotlinLogging
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import java.nio.file.Path
import kotlin.uuid.Uuid
import org.javafreedom.kbeatz.catalog.api.models.ErrorResponse
import org.javafreedom.kbeatz.catalog.api.models.LayoutPreview as ApiLayoutPreview
import org.javafreedom.kbeatz.catalog.api.models.LayoutSettings as ApiLayoutSettings
import org.javafreedom.kbeatz.catalog.domain.model.Album
import org.javafreedom.kbeatz.catalog.domain.model.DirectoryTemplate
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumRepository
import org.javafreedom.kbeatz.catalog.domain.service.DirectoryLayoutPlanner

private val log = KotlinLogging.logger {}

/**
 * Ktor route handlers for the read-only directory-layout settings panel (story #818).
 *
 * - `GET /settings/layout` returns the active operator-configured template plus the
 *   tokens it may reference. Nothing here is user-editable; the template is config.
 * - `GET /settings/layout/preview/{albumId}` renders the planned target directory for a
 *   single album so the user can see the layout before running a relayout.
 *
 * Both endpoints perform zero disk writes and store nothing. When the planner rejects an
 * album because the rendered path would escape the library root, the preview reports the
 * rejection as data (withinLibraryRoot=false + message) with a 200, never a 500.
 *
 * @param directoryTemplate The raw operator-configured template string (read-only in the UI).
 * @param libraryRoot Absolute path to the library root; used to relativise directory paths.
 *
 * No auth in v1 (trusted LAN deployment).
 */
fun Route.settingsRoutes(
    albumRepository: AlbumRepository,
    planner: DirectoryLayoutPlanner,
    directoryTemplate: String,
    libraryRoot: Path,
) {
    get("/settings/layout") {
        call.respond(
            HttpStatusCode.OK,
            ApiLayoutSettings(
                directoryTemplate = directoryTemplate,
                supportedTokens = DirectoryTemplate.SUPPORTED_TOKENS.sorted(),
            ),
        )
    }

    get("/settings/layout/preview/{albumId}") {
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
            else -> respondPreview(call, albumRepository, planner, libraryRoot, albumId)
        }
    }
}

private suspend fun respondPreview(
    call: ApplicationCall,
    albumRepository: AlbumRepository,
    planner: DirectoryLayoutPlanner,
    libraryRoot: Path,
    albumId: Uuid,
) {
    val album = albumRepository.findById(albumId)
    if (album == null) {
        call.respond(
            HttpStatusCode.NotFound,
            ErrorResponse(code = "RESOURCE_NOT_FOUND", message = "Album '$albumId' not found"),
        )
        return
    }
    call.respond(HttpStatusCode.OK, album.toLayoutPreview(planner, libraryRoot))
}

/**
 * Renders the layout preview for [this] album. The traversal guard is reported as data: a
 * [SecurityException] from the planner becomes withinLibraryRoot=false with plannedDirectory=null,
 * not an error status. No PII or stack traces leak into the message.
 */
private fun Album.toLayoutPreview(planner: DirectoryLayoutPlanner, libraryRoot: Path): ApiLayoutPreview {
    val currentDirectory = libraryRoot.relativise(directoryPath)
    return try {
        val result = planner.planTargetDirectory(this, libraryRoot.toString())
        ApiLayoutPreview(
            albumId = id.toString(),
            currentDirectory = currentDirectory,
            plannedDirectory = result.relativePath,
            withinLibraryRoot = true,
            message = null,
        )
    } catch (ex: SecurityException) {
        log.info { "layout_preview_rejected albumId=$id reason=${ex.message}" }
        ApiLayoutPreview(
            albumId = id.toString(),
            currentDirectory = currentDirectory,
            plannedDirectory = null,
            withinLibraryRoot = false,
            message = "Planned directory would escape the library root",
        )
    }
}

/** Relativises an absolute [directoryPath] against [this] library root, falling back to the raw path. */
private fun Path.relativise(directoryPath: String): String =
    runCatching { relativize(Path.of(directoryPath)).toString() }.getOrDefault(directoryPath)
