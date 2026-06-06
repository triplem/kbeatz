package org.javafreedom.kbeatz.catalog.domain.model

/**
 * Result of a Discogs sync operation for a single album.
 *
 * @property fieldsWritten The Vorbis Comment tag names that were written (e.g. "ALBUM", "DATE").
 * @property warnings Non-fatal warnings that occurred during sync (e.g. image quota exhausted).
 * @property updatedAlbum The album domain object after the sync has been applied.
 */
data class SyncResult(
    val fieldsWritten: List<String>,
    val warnings: List<String>,
    val updatedAlbum: Album,
)
