package org.javafreedom.kbeatz.catalog.application.service

import io.github.oshai.kotlinlogging.KotlinLogging
import kotlin.uuid.Uuid
import org.javafreedom.kbeatz.catalog.domain.model.ChangeOperation
import org.javafreedom.kbeatz.catalog.domain.model.ChangePlan
import org.javafreedom.kbeatz.common.BusinessValidationException

private val logger = KotlinLogging.logger {}

/**
 * Use-case that computes a dry-run [ChangePlan] for one or many releases, stores it for later
 * retrieval, and returns it.
 *
 * Planning performs zero disk writes (story #815). Conflicts are carried inside the plan as
 * data rather than thrown as failures.
 *
 * @property planService Builds the consolidated plan from album metadata.
 * @property store Persists the plan by id so story #816 can apply it later.
 */
class ChangePlanFacade(
    private val planService: ChangePlanService,
    private val store: ChangePlanStore,
) {

    /**
     * Computes and stores a dry-run plan for [operation] over the given [albumIds].
     *
     * Only [ChangeOperation.RELAYOUT] is supported in this iteration. RETAG and DISCOGS_SYNC
     * dry runs require the tag-source pipeline wired in story #817 and currently signal an
     * unavailable operation.
     *
     * @param operation The bulk operation to plan.
     * @param albumIds The releases to include; must not be empty.
     * @return The stored consolidated plan.
     * @throws BusinessValidationException when [albumIds] is empty or [operation] is not yet
     * available as a dry run.
     */
    suspend fun createPlan(operation: ChangeOperation, albumIds: List<Uuid>): ChangePlan {
        if (albumIds.isEmpty()) {
            throw BusinessValidationException("albumIds must contain at least one album id")
        }
        val plan = when (operation) {
            ChangeOperation.RELAYOUT -> planService.planRelayout(albumIds)
            // TODO(#817): route RETAG/DISCOGS_SYNC through the tag-source pipeline
            ChangeOperation.RETAG, ChangeOperation.DISCOGS_SYNC ->
                throw OperationNotAvailableException(operation)
        }
        store.put(plan)
        logger.info {
            "change_plan_stored planId=${plan.id} operation=$operation releases=${plan.releases.size} " +
                "moves=${plan.totalMoves} conflicts=${plan.totalConflicts}"
        }
        return plan
    }

    /**
     * Returns the stored plan for [planId], or null when no plan with that id exists.
     */
    fun getPlan(planId: Uuid): ChangePlan? = store.get(planId)
}

/**
 * Signals that a requested [ChangeOperation] has no dry-run implementation in this iteration.
 *
 * Surfaced to clients as HTTP 422 with code `OPERATION_NOT_AVAILABLE`. Not a domain exception:
 * the catalog StatusPages plugin maps [BusinessValidationException] to a generic 422, but this
 * case carries a distinct error code, so the handler catches it explicitly.
 */
class OperationNotAvailableException(operation: ChangeOperation) : RuntimeException(
    "Dry-run planning for $operation is enabled in a later iteration (story #817)"
)
