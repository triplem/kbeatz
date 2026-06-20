package org.javafreedom.kbeatz.catalog.application.service

import io.github.oshai.kotlinlogging.KotlinLogging
import kotlin.uuid.Uuid
import org.javafreedom.kbeatz.catalog.domain.model.ReleaseChangeSet
import org.javafreedom.kbeatz.catalog.infrastructure.move.DirectoryMoveExecutor
import org.javafreedom.kbeatz.common.ResourceNotFoundException

private val logger = KotlinLogging.logger {}

/** The outcome of applying a single release within a change plan. */
enum class ReleaseApplyOutcome { APPLIED, SKIPPED, FAILED }

/**
 * The result of applying one release.
 *
 * @property albumId The release this result describes.
 * @property outcome Whether the release was applied, skipped, or failed.
 * @property message A human-readable explanation for a SKIPPED or FAILED outcome; null otherwise.
 */
data class ReleaseApplyResult(
    val albumId: Uuid,
    val outcome: ReleaseApplyOutcome,
    val message: String?,
)

/**
 * The aggregate result of applying a change plan, with a per-release breakdown and counts.
 *
 * @property planId The id of the applied plan.
 * @property releases One result per release in the plan.
 */
data class ApplyResult(
    val planId: Uuid,
    val releases: List<ReleaseApplyResult>,
) {
    /** Number of releases applied successfully. */
    val appliedCount: Int get() = releases.count { it.outcome == ReleaseApplyOutcome.APPLIED }

    /** Number of releases skipped because of conflicts. */
    val skippedCount: Int get() = releases.count { it.outcome == ReleaseApplyOutcome.SKIPPED }

    /** Number of releases that failed to apply. */
    val failedCount: Int get() = releases.count { it.outcome == ReleaseApplyOutcome.FAILED }
}

/**
 * Use-case that APPLIES a previously computed dry-run [org.javafreedom.kbeatz.catalog.domain.model.ChangePlan]
 * by id (story #816). Nothing is written to disk until this call: it is the user's confirmation
 * of the presented plan (AC-E5).
 *
 * Each release is applied independently so a single failure never aborts the batch (AC-E6):
 *
 * - A release with conflicts is SKIPPED without touching disk.
 * - A directory move is delegated to [DirectoryMoveExecutor], which moves atomically under a
 *   write lock with crash-recoverable journalling and is idempotent (AC-E8). Re-applying an
 *   already-moved release reconciles to a no-op, so re-apply is a safe no-op overall.
 * - Tag changes are delegated to the [TagChangeApplier] port.
 * - Any exception from the executor or applier is caught per release and reported as FAILED;
 *   the executor guarantees the release is not left half-applied.
 *
 * @property store The plan store shared with the planning step (story #815).
 * @property directoryMoveExecutor Atomic, journalled, idempotent directory move executor (#814).
 * @property tagChangeApplier Writes tag changes for a release (real impl arrives with #817).
 */
class ChangePlanApplyService(
    private val store: ChangePlanStore,
    private val directoryMoveExecutor: DirectoryMoveExecutor,
    private val tagChangeApplier: TagChangeApplier,
) {

    /**
     * Applies the stored plan with the given [planId].
     *
     * @throws ResourceNotFoundException when no plan with [planId] is stored (mapped to 404).
     */
    suspend fun apply(planId: Uuid): ApplyResult {
        val plan = store.get(planId) ?: throw ResourceNotFoundException("Change plan", planId.toString())
        logger.info { "change_plan_apply_start planId=$planId releases=${plan.releases.size}" }

        val results = plan.releases.map { applyRelease(it) }

        val result = ApplyResult(planId, results)
        logger.info {
            "change_plan_apply_done planId=$planId applied=${result.appliedCount} " +
                "skipped=${result.skippedCount} failed=${result.failedCount}"
        }
        return result
    }

    @Suppress("TooGenericExceptionCaught") // per-release isolation: any failure must not abort the batch (AC-E6)
    private suspend fun applyRelease(release: ReleaseChangeSet): ReleaseApplyResult {
        if (release.hasConflicts) {
            val summary = release.conflicts.joinToString("; ") { "${it.type}: ${it.message}" }
            logger.info { "change_plan_apply_skip albumId=${release.albumId} conflicts=${release.conflicts.size}" }
            return ReleaseApplyResult(release.albumId, ReleaseApplyOutcome.SKIPPED, "Skipped: $summary")
        }
        return try {
            release.directoryMove?.let { directoryMoveExecutor.execute(it) }
            if (release.tagChanges.isNotEmpty()) {
                tagChangeApplier.apply(release.albumId, release.tagChanges)
            }
            ReleaseApplyResult(release.albumId, ReleaseApplyOutcome.APPLIED, null)
        } catch (ex: Exception) {
            logger.error(ex) { "change_plan_apply_failed albumId=${release.albumId}" }
            ReleaseApplyResult(release.albumId, ReleaseApplyOutcome.FAILED, ex.message)
        }
    }
}
