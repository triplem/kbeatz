package org.javafreedom.kbeatz.catalog.domain.model

import kotlin.uuid.Uuid

/**
 * A single field comparison produced by a dry-run sync preview.
 *
 * @property field Vorbis Comment tag name (uppercase, e.g. "GENRE").
 * @property currentValue Current value stored in the album index, or empty string if not set.
 * @property proposedValue Value that the sync would write.
 */
data class SyncFieldChange(
    val field: String,
    val currentValue: String,
    val proposedValue: String,
)

/**
 * Result of a dry-run sync preview: the proposed changes that would be applied if
 * the user confirms the sync. Only fields whose proposed value differs from the
 * current album value are included.
 *
 * @property albumId UUID of the album.
 * @property proposedChanges Fields that would change; empty when Discogs data matches current values.
 */
data class SyncPreview(
    val albumId: Uuid,
    val proposedChanges: List<SyncFieldChange>,
)
