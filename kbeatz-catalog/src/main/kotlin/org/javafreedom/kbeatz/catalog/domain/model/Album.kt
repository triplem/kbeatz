package org.javafreedom.kbeatz.catalog.domain.model

import kotlin.uuid.Uuid

data class Album(
    val id: Uuid,
    val albumArtist: String,
    val album: String,
    val date: String?,
    val genre: String?,
    val label: String?,
    val catalogNumber: String?,
    val composer: String?,
    val conductor: String?,
    val ensemble: String?,
    val country: String? = null,
    val discogsId: String?,
    val directoryPath: String,
    val extraTags: Map<String, String>?,
    val images: List<ImageDescriptor>?,
    /**
     * Additional directories that were merged into this album entry during deduplication.
     *
     * When [LibraryWalker] groups tracks from multiple sibling directories into a single
     * [AlbumGroup] (e.g. `jazz/lossless/` and `jazz/backup/` both contain the same release),
     * all source directories except the primary [directoryPath] are stored here.
     *
     * Empty for albums that originate from a single directory.
     * Used by [TagWriteService] to ensure tag writes reach all merged directories.
     */
    val mergedDirectories: List<String> = emptyList(),
    /** Number of tracks; null when no track data is available for this album. */
    val trackCount: Int? = null,
    /** Total playback duration in seconds; null when no track data is available. */
    val totalDurationSeconds: Int? = null,
) {
    /** True when at least one [ImageDescriptor] is present (embedded or folder art). */
    val hasCoverArt: Boolean get() = !images.isNullOrEmpty()
}
