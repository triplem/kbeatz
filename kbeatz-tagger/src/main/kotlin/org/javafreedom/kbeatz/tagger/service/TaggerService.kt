package org.javafreedom.kbeatz.tagger.service

import kotlinx.io.files.Path
import org.javafreedom.kbeatz.common.metadata.KbeatzMetadata

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

    /**
     * Writes Vorbis Comment tags to all FLAC files in [albumDir] using the given [metadata].
     *
     * Reads .kbeatz/metadata.json from [albumDir], determines disc layout (single-disc vs
     * multi-disc), validates FLAC file counts against track counts, then writes per-disc
     * tags and embeds any images listed in [metadata] whose localPath exists on disk.
     *
     * This method is synchronous because it only performs local filesystem operations.
     *
     * @param albumDir  Path to the album root directory.
     * @param metadata  Provider-agnostic album metadata to apply.
     * @return [TagResult] describing success, a mismatch, or an unexpected error.
     */
    fun tag(albumDir: Path, metadata: KbeatzMetadata): TagResult
}

sealed class TagResult {
    data class Tagged(val albumDir: Path, val discogsId: String, val filesWritten: Int) : TagResult()
    data class Skipped(val albumDir: Path, val reason: String) : TagResult()
    /**
     * [albumDir] is retained for caller convenience even though the CLI currently logs the
     * path via its own loop variable. Retained to give callers a self-contained result
     * without needing to carry the path separately.
     */
    data class Failed(val albumDir: Path, val cause: Throwable) : TagResult()
    data class TrackCountMismatch(val albumDir: Path, val disc: Int, val files: Int, val expected: Int) : TagResult()
}
