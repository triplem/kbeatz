package org.javafreedom.kbeatz.catalog.domain.service

import java.nio.file.Paths
import org.javafreedom.kbeatz.catalog.domain.model.Album
import org.javafreedom.kbeatz.catalog.domain.model.DirectoryLayoutResult
import org.javafreedom.kbeatz.catalog.domain.model.DirectoryTemplate

/**
 * Pure domain service that plans the target on-disk directory for an [Album] from a
 * configurable [DirectoryTemplate].
 *
 * This service performs NO filesystem I/O: it only renders the template, sanitises each
 * resulting path segment, and lexically normalises the result. The traversal guard
 * (NFR-06) is enforced in-memory: every resolved path must stay inside the library root.
 *
 * @property template The validated directory-structure template.
 */
class DirectoryLayoutPlanner(private val template: DirectoryTemplate) {

    /**
     * Resolves [album] to its target directory under [libraryRoot].
     *
     * @param album The album whose metadata drives token substitution.
     * @param libraryRoot Absolute path to the music library root directory.
     * @return The planned [DirectoryLayoutResult] with sanitised relative and absolute paths.
     * @throws SecurityException if the normalised target escapes [libraryRoot].
     */
    fun planTargetDirectory(album: Album, libraryRoot: String): DirectoryLayoutResult {
        // Neutralise illegal characters (including '/') in token VALUES before rendering, so the
        // only '/' left in the rendered string are the literal segment separators of the TEMPLATE.
        val safeTokens = buildTokenMap(album).mapValues { (_, value) -> neutraliseIllegalChars(value) }
        val rendered = template.render(safeTokens)
        val relativePath = sanitiseRelativePath(rendered)

        val rootPath = Paths.get(libraryRoot).normalize()
        val resolved = rootPath.resolve(relativePath).normalize()
        if (!resolved.startsWith(rootPath)) {
            throw SecurityException(
                "Planned directory escapes the library root: relativePath=$relativePath"
            )
        }
        return DirectoryLayoutResult(
            relativePath = relativePath,
            absolutePath = resolved.toString(),
        )
    }

    private fun buildTokenMap(album: Album): Map<String, String> = mapOf(
        "ALBUMARTIST" to album.albumArtist,
        "ALBUM" to album.album,
        "DATE" to album.date.orEmpty(),
        "YEAR" to deriveYear(album.date),
        "GENRE" to album.genre.orEmpty(),
        "LABEL" to album.label.orEmpty(),
        "CATALOGNUMBER" to album.catalogNumber.orEmpty(),
        "COMPOSER" to album.composer.orEmpty(),
        "CONDUCTOR" to album.conductor.orEmpty(),
        "ENSEMBLE" to album.ensemble.orEmpty(),
        "COUNTRY" to album.country.orEmpty(),
        "MEDIAFORMAT" to album.mediaFormat.orEmpty(),
    )

    private fun deriveYear(date: String?): String {
        val candidate = date?.take(YEAR_LENGTH).orEmpty()
        return if (candidate.length == YEAR_LENGTH && candidate.all { it.isDigit() }) candidate else ""
    }

    /** Replaces filesystem-illegal characters and control characters in a token value with `_`. */
    private fun neutraliseIllegalChars(value: String): String =
        value.map { ch -> if (ch in ILLEGAL_CHARS || ch.isISOControl()) REPLACEMENT else ch }
            .joinToString("")

    /**
     * Splits the rendered template on the segment separator, cleans up each segment, drops
     * empty segments, and rejoins with `/`. The `/` separators originate solely from the
     * TEMPLATE: token-value `/` characters were already neutralised before rendering.
     */
    private fun sanitiseRelativePath(rendered: String): String =
        rendered.split(SEGMENT_SEPARATOR)
            .map { cleanSegment(it) }
            .filter { it.isNotEmpty() }
            .joinToString(SEGMENT_SEPARATOR.toString())

    /**
     * Cleans up a single rendered path segment:
     * - collapses repeated whitespace to a single space,
     * - collapses the empty `()` / `( )` artifact left by a missing token,
     * - trims, then strips leading and trailing dots and spaces.
     */
    private fun cleanSegment(segment: String): String =
        segment
            .replace(WHITESPACE_RUN, " ")
            .replace(EMPTY_PARENS, "")
            .trim()
            .trim('.', ' ')
            .trim()

    companion object {
        private const val YEAR_LENGTH = 4
        private const val SEGMENT_SEPARATOR = '/'
        private const val REPLACEMENT = '_'

        /** Characters that are illegal in path segments on common filesystems plus the separator. */
        private val ILLEGAL_CHARS = setOf('/', '\\', ':', '*', '?', '"', '<', '>', '|')
        private val WHITESPACE_RUN = Regex("""\s+""")
        private val EMPTY_PARENS = Regex("""\(\s*\)""")
    }
}
