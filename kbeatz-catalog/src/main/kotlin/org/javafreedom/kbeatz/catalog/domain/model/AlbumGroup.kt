package org.javafreedom.kbeatz.catalog.domain.model

import java.nio.file.Path

/**
 * A logical album unit discovered by [org.javafreedom.kbeatz.catalog.application.service.LibraryWalker].
 *
 * An album group represents one or more directories that belong to the same album
 * (e.g. a multi-disc release where disc1/ and disc2/ are under the same parent, or
 * a deduplicated release found in both `jazz/lossless/` and `jazz/backup/`).
 *
 * @property rootPath Absolute path of the album's root directory. For single-disc albums
 *   this is the album directory. For multi-disc albums this is the parent of the disc
 *   subdirectories. For deduplicated albums spanning multiple sibling directories this is
 *   the shallowest (primary) directory chosen by LibraryWalker.
 * @property sourceDirs All distinct canonical directories that contributed FLAC files to
 *   this group. Includes [rootPath] itself. For single-directory albums this has exactly
 *   one element. For deduplicated albums this contains all merged sibling directories.
 * @property flacPaths Absolute paths of all FLAC files in this album group (across all discs).
 * @property albumArtist ALBUMARTIST Vorbis Comment tag from the first FLAC file in the group.
 * @property albumTitle ALBUM Vorbis Comment tag from the first FLAC file.
 * @property date DATE Vorbis Comment tag from the first FLAC file, or null if absent.
 */
data class AlbumGroup(
    val rootPath: Path,
    val sourceDirs: List<Path>,
    val flacPaths: List<Path>,
    val albumArtist: String,
    val albumTitle: String,
    val date: String?,
)
