package org.javafreedom.kbeatz.catalog.util

import io.github.oshai.kotlinlogging.KotlinLogging
import java.nio.file.Files
import java.nio.file.Path

private val log = KotlinLogging.logger {}

/**
 * Enforces that a given path is within an expected library root directory.
 *
 * Uses [Path.toRealPath] when the path exists so that symlinks pointing outside
 * the root are caught, not just lexical traversal sequences (e.g. `../../etc`).
 * Falls back to [Path.normalize] for paths that do not yet exist on disk.
 */
object PathGuard {

    /**
     * Asserts that [path] is within [libraryRoot], throwing [SecurityException] otherwise.
     *
     * - When [path] exists on disk, [Path.toRealPath] is used to resolve symlinks.
     *   A symlink inside [libraryRoot] that points outside it will throw.
     * - When [path] does not exist yet, [Path.normalize] is used instead so that
     *   paths to not-yet-created files can still be validated before creation.
     *
     * @param path The path to validate.
     * @param libraryRoot The expected parent directory.
     * @throws SecurityException if [path] resolves to a location outside [libraryRoot].
     */
    fun assertWithinLibraryRoot(path: Path, libraryRoot: Path) {
        val resolved = if (Files.exists(path)) path.toRealPath() else path.normalize()
        val normalizedRoot = libraryRoot.normalize()
        if (!resolved.startsWith(normalizedRoot)) {
            log.warn { "path_traversal_attempt path=$path libraryRoot=$normalizedRoot resolved=$resolved" }
            throw SecurityException("Path is outside the library root: $path")
        }
    }
}
