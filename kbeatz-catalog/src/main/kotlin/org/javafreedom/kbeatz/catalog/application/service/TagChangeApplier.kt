package org.javafreedom.kbeatz.catalog.application.service

import kotlin.uuid.Uuid
import org.javafreedom.kbeatz.catalog.domain.model.ChangeOperation
import org.javafreedom.kbeatz.catalog.domain.model.TagChange

/**
 * Port that writes a set of [TagChange]s for one release to the underlying FLAC files.
 *
 * Apply of a change plan (story #816) calls this for any release whose change set contains
 * tag changes. RELAYOUT plans carry no tag changes, so this path is not exercised until
 * story #817 wires the real FLAC/tag applier and enables tag-bearing plans.
 */
interface TagChangeApplier {
    /**
     * Applies [changes] to the release identified by [albumId].
     *
     * @throws OperationNotAvailableException from the default implementation until #817 supplies
     * the real applier.
     */
    suspend fun apply(albumId: Uuid, changes: List<TagChange>)
}

/**
 * Default [TagChangeApplier] that has no FLAC/tag write path yet.
 *
 * RELAYOUT plans (the only plans #815 can produce) contain no tag changes, so apply never invokes
 * this for an in-scope plan. If a tag-bearing plan ever reaches apply before #817 lands, the
 * per-release catch in the apply service records the release as FAILED rather than aborting the
 * batch.
 */
class UnavailableTagChangeApplier : TagChangeApplier {
    override suspend fun apply(albumId: Uuid, changes: List<TagChange>) {
        // TODO(#817): supply the real FLAC/tag applier and replace this wiring in DependencyContainer
        throw OperationNotAvailableException(ChangeOperation.RETAG)
    }
}
