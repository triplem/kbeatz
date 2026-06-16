package org.javafreedom.kbeatz.catalog.application.service

import io.github.oshai.kotlinlogging.KotlinLogging
import java.io.IOException
import java.nio.file.FileVisitResult
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.SimpleFileVisitor
import java.nio.file.attribute.BasicFileAttributes
import kotlin.io.path.extension
import kotlin.io.path.isDirectory
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

        /**
         * Fallback value used for ALBUMARTIST when neither ALBUMARTIST nor ARTIST Vorbis Comment
         * tags are present in any FLAC file in the album directory.
         *
         * Albums with this value appear at the top of alphabetical artist lists and are
         * easy to identify for manual tagging.
         */
        const val UNKNOWN_ARTIST_FALLBACK = "Unknown Artist"

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

    private fun collectFlacFiles(root: Path): List<Path> {
        val result = mutableListOf<Path>()
        Files.walkFileTree(root, object : SimpleFileVisitor<Path>() {
            override fun visitFile(file: Path, attrs: BasicFileAttributes): FileVisitResult {
                if (file.extension.equals("flac", ignoreCase = true)) result.add(file)
                return FileVisitResult.CONTINUE
            }

            override fun visitFileFailed(file: Path, exc: IOException): FileVisitResult {
                log.warn { "Skipping inaccessible path during walk: $file (${exc.message})" }
                return FileVisitResult.CONTINUE
            }

            override fun preVisitDirectory(dir: Path, attrs: BasicFileAttributes): FileVisitResult =
                FileVisitResult.CONTINUE
        })
        return result.sorted()
    }

    private fun groupFlacFiles(flacFiles: List<Path>, libraryRoot: Path): List<AlbumGroup> {
        // Deduplication key: (albumArtist, albumTitle, yearKey).
        //
        // Rationale: two directories storing the same release (e.g. a re-rip or
        // a split disc layout not under a disc1/disc2 parent) must produce a single
        // album entry on the overview.  Including the canonical directory in the key
        // caused separate entries for such releases (issue #657).
        //
        // Disambiguation: albums that truly differ (same title, different year) are
        // kept separate because the DATE tag year component differs.  When DATE is
        // absent, tracks from distinct directories merge into one group; the user can
        // add DATE tags to their files to force separation.
        //
        // Date normalisation: the grouping key uses only the first 4 characters of
        // the DATE tag (the year) so that tracks tagged "1959" and "1959-05-04"
        // are treated as the same release.  The AlbumGroup carries the full date
        // string from the first track encountered.  See ADR-010-album-deduplication.adoc.
        data class GroupKey(val albumArtist: String, val albumTitle: String, val yearKey: String?)
        data class TrackMeta(val path: Path, val canonicalDir: Path, val fullDate: String?)

        val groups = mutableMapOf<GroupKey, MutableList<TrackMeta>>()

        flacFiles.forEach { flacPath ->
            val tags = readTags(flacPath) ?: return@forEach

            val albumArtist = tags["ALBUMARTIST"] ?: tags["ARTIST"] ?: UNKNOWN_ARTIST_FALLBACK
            val albumTitle = tags["ALBUM"].orEmpty()
            val fullDate = tags["DATE"]?.takeIf { it.isNotBlank() }
            // Normalise to 4-digit year for grouping so that "1959" and "1959-05-04" merge.
            @Suppress("MagicNumber") // 4 = length of 4-digit year prefix in ISO date strings
            val yearKey = fullDate?.take(4)

            val dir = flacPath.parent ?: libraryRoot
            val canonicalDir = if (isDiscSubdir(dir)) dir.parent ?: dir else dir

            val key = GroupKey(albumArtist, albumTitle, yearKey)
            groups.getOrPut(key) { mutableListOf() }.add(TrackMeta(flacPath, canonicalDir, fullDate))
        }

        return groups.map { (key, tracks) ->
            // When tracks come from multiple directories pick the shallowest (shortest
            // path) canonical directory as the representative root.  This is a stable
            // choice: the alphabetically-first shallowest directory wins when two paths
            // have the same depth.
            val allDirs = tracks.map { it.canonicalDir }.distinct()
            val rootPath = allDirs.minWith(compareBy({ it.nameCount }, { it.toString() }))

            // Carry the full date string (not just the year) from the first track.
            val representativeDate = tracks.firstNotNullOfOrNull { it.fullDate }

            AlbumGroup(
                rootPath = rootPath,
                sourceDirs = allDirs,
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
