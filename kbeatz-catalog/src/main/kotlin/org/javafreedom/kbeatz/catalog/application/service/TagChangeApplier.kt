package org.javafreedom.kbeatz.catalog.application.service

import kotlin.uuid.Uuid
import org.javafreedom.kbeatz.catalog.domain.model.TagChange

/**
 * Port that writes a set of [TagChange]s for one release to the underlying FLAC files.
 *
 * Apply of a change plan (story #816) calls this for any release whose change set contains tag
 * changes. The production implementation is [FlacTagChangeApplier] (story #817), which routes the
 * write through the single shared FLAC tag-write path so manual retag, Discogs sync, and change-plan
 * apply all converge on one atomic writer (AC-E10).
 */
interface TagChangeApplier {
    /**
     * Applies [changes] to the release identified by [albumId].
     */
    suspend fun apply(albumId: Uuid, changes: List<TagChange>)
}
