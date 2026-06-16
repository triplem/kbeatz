package org.javafreedom.kbeatz.catalog.domain.model

import kotlin.uuid.Uuid

/**
 * Represents a single FLAC track within an [Album].
 *
 * All ID fields use [kotlin.uuid.Uuid] (not java.util.UUID).
 * No java.time.* types are used here; timestamps live only in the persistence layer.
 *
 * Per-track [composer], [conductor], and [ensemble] take precedence over the parent album's
 * values. When null, callers should fall back to the album-level values for display.
 *
 * [trackNumber], [discNumber], [trackTotal], [discTotal] are VARCHAR in the schema because
 * Vorbis TRACKNUMBER may be "1", "A1", or "1/12".
 *
 * [path] is relative to the album directory. Full path is:
 *   resolve(CATALOG_LIBRARY_ROOT, album.directoryPath, track.path)
 */
data class Track(
    val id: Uuid,
    val albumId: Uuid,
    val title: String?,
    val trackNumber: String?,
    val discNumber: String?,
    val trackTotal: String?,
    val discTotal: String?,
    val artist: String?,
    val composer: String?,
    val conductor: String?,
    val ensemble: String?,
    val durationSeconds: Int?,
    val path: String,
    val images: List<ImageDescriptor>?,
    val extraTags: Map<String, String>?,
)
