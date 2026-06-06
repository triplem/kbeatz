package org.javafreedom.kbeatz.catalog.domain.model

import java.nio.file.Path

/**
 * A logical album unit discovered by [org.javafreedom.kbeatz.catalog.application.service.LibraryWalker].
 *
 * An album group represents one or more directories that belong to the same album
 * (e.g. a multi-disc release where disc1/ and disc2/ are under the same parent).
 *
 * @property rootPath Absolute path of the album's root directory. For single-disc albums
 *   this is the album directory. For multi-disc albums this is the parent of the disc
 *   subdirectories.
 * @property flacPaths Absolute paths of all FLAC files in this album group (across all discs).
 * @property albumArtist ALBUMARTIST Vorbis Comment tag from the first FLAC file in the group.
 * @property albumTitle ALBUM Vorbis Comment tag from the first FLAC file.
 * @property date DATE Vorbis Comment tag from the first FLAC file, or null if absent.
 */
data class AlbumGroup(
    val rootPath: Path,
    val flacPaths: List<Path>,
    val albumArtist: String,
    val albumTitle: String,
    val date: String?,
)
