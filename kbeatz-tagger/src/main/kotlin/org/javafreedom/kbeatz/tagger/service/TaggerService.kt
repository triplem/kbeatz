package org.javafreedom.kbeatz.tagger.service

import kotlinx.io.files.Path

/**
 * Port: tags an album directory from a remote metadata source.
 *
 * Consumed by:
 *   - kbeatz-catalog (in-process, for UI-triggered Discogs sync)
 *   - kbeatz-tagger CLI (via TagAlbumsCommand)
 */
interface TaggerService {

    /**
     * Fetches release metadata for the given [albumDir] (via its id file) and writes
     * Vorbis Comment tags to all FLAC files in the directory.
     *
     * @param albumDir   Path to the album root directory.
     * @param downloadImages  When true, downloads and embeds cover art + writes folder.jpg.
     *                        Defaults to false to preserve the Discogs image quota.
     * @return [TagResult] describing what was written or why the operation was skipped.
     */
    suspend fun tagAlbum(albumDir: Path, downloadImages: Boolean = false): TagResult
}

sealed class TagResult {
    data class Tagged(val albumDir: Path, val discogsId: String, val filesWritten: Int) : TagResult()
    data class Skipped(val albumDir: Path, val reason: String) : TagResult()
    data class Failed(val albumDir: Path, val cause: Throwable) : TagResult()
}
