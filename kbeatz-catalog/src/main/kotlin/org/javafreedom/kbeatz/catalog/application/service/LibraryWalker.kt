package org.javafreedom.kbeatz.catalog.application.service

import io.github.oshai.kotlinlogging.KotlinLogging
import java.nio.file.Files
import java.nio.file.Path
import kotlin.io.path.extension
import kotlin.io.path.isDirectory
import kotlin.io.path.isRegularFile
import kotlin.io.path.name
import kotlinx.io.files.Path as KtPath
import org.javafreedom.kbeatz.catalog.domain.model.AlbumGroup
import org.javafreedom.kbeatz.tagger.codec.flac.FlacFile

private val log = KotlinLogging.logger {}

/**
 * Walks a music library root directory and groups discovered FLAC files into [AlbumGroup]s.
 *
 * ## Grouping algorithm
 *
 * 1. Scan the library root recursively for files with the `.flac` extension (case-insensitive).
 * 2. Read the Vorbis Comment tags from each FLAC file to extract the grouping key
 *    `(ALBUMARTIST, ALBUM, DATE, canonicalDir)`.
 * 3. Multi-disc support: if a FLAC file's immediate parent directory is named `disc1`, `disc2`, …
 *    (case-insensitive regex `disc\d+`), the grandparent is used as the canonical directory.
 * 4. Files with the same canonical directory AND the same `(ALBUMARTIST, ALBUM)` tuple are merged
 *    into one [AlbumGroup]. DATE may be absent — the group is still formed correctly.
 * 5. Unreadable FLAC files are skipped with a WARN log entry; they do not abort the walk.
 *
 * This class has no database dependency. It returns a pure list of [AlbumGroup]s suitable for
 * downstream persistence by [org.javafreedom.kbeatz.catalog.application.service.LibraryScanService].
 */
class LibraryWalker {

    companion object {
        private val DISC_DIR_PATTERN = Regex("disc\\d+", RegexOption.IGNORE_CASE)
    }

    /**
     * Walk [libraryRoot] and return all discovered album groups.
     *
     * @throws IllegalArgumentException if [libraryRoot] does not exist or is not a directory.
     */
    fun walk(libraryRoot: Path): List<AlbumGroup> {
        require(libraryRoot.isDirectory()) { "Library root is not a directory: $libraryRoot" }

        log.info { "Starting library walk at: $libraryRoot" }

        val flacFiles = collectFlacFiles(libraryRoot)
        log.info { "Discovered ${flacFiles.size} FLAC files" }

        return groupFlacFiles(flacFiles, libraryRoot)
    }

    private fun collectFlacFiles(root: Path): List<Path> =
        Files.walk(root).use { stream ->
            stream
                .filter { it.isRegularFile() && it.extension.equals("flac", ignoreCase = true) }
                .sorted()
                .toList()
        }

    private fun groupFlacFiles(flacFiles: List<Path>, libraryRoot: Path): List<AlbumGroup> {
        // Map of (canonicalDir, albumArtist, albumTitle) → list of (path, date)
        data class GroupKey(val canonicalDir: Path, val albumArtist: String, val albumTitle: String)
        data class TrackMeta(val path: Path, val date: String?)

        val groups = mutableMapOf<GroupKey, MutableList<TrackMeta>>()

        flacFiles.forEach { flacPath ->
            val tags = readTags(flacPath) ?: return@forEach

            val albumArtist = tags["ALBUMARTIST"] ?: tags["ARTIST"].orEmpty()
            val albumTitle = tags["ALBUM"].orEmpty()
            val date = tags["DATE"]?.takeIf { it.isNotBlank() }

            val dir = flacPath.parent ?: libraryRoot
            val canonicalDir = if (isDiscSubdir(dir)) dir.parent ?: dir else dir

            val key = GroupKey(canonicalDir, albumArtist, albumTitle)
            groups.getOrPut(key) { mutableListOf() }.add(TrackMeta(flacPath, date))
        }

        return groups.map { (key, tracks) ->
            val representativeDate = tracks.mapNotNull { it.date }.firstOrNull()
            AlbumGroup(
                rootPath = key.canonicalDir,
                flacPaths = tracks.map { it.path },
                albumArtist = key.albumArtist,
                albumTitle = key.albumTitle,
                date = representativeDate,
            )
        }
    }

    private fun isDiscSubdir(dir: Path): Boolean =
        DISC_DIR_PATTERN.matches(dir.name)

    @Suppress("TooGenericExceptionCaught") // intentional: any I/O or parse error skips the file
    private fun readTags(flacPath: Path): Map<String, String>? =
        try {
            val flacFile = FlacFile.read(KtPath(flacPath.toString()))
            flacFile.vorbisComment?.toMap()?.mapValues { (_, values) -> values.firstOrNull().orEmpty() }
        } catch (ex: Exception) {
            log.warn(ex) { "Skipping unreadable FLAC file: $flacPath" }
            null
        }
}
