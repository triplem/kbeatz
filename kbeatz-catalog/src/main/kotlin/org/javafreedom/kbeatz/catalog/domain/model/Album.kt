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
    val discogsId: String?,
    val directoryPath: String,
    val extraTags: Map<String, String>?,
    val images: List<ImageDescriptor>?,
    /** Number of tracks; null when no track data is available for this album. */
    val trackCount: Int? = null,
    /** Total playback duration in seconds; null when no track data is available. */
    val totalDurationSeconds: Int? = null,
) {
    /** True when at least one [ImageDescriptor] is present (embedded or folder art). */
    val hasCoverArt: Boolean get() = !images.isNullOrEmpty()
}
