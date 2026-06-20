package org.javafreedom.kbeatz.catalog.application.service

import io.github.oshai.kotlinlogging.KotlinLogging
import kotlin.uuid.Uuid
import org.javafreedom.kbeatz.catalog.domain.model.ChangeOperation
import org.javafreedom.kbeatz.catalog.domain.model.ChangePlan
import org.javafreedom.kbeatz.catalog.domain.model.ConflictType
import org.javafreedom.kbeatz.catalog.domain.model.PlanConflict
import org.javafreedom.kbeatz.catalog.domain.port.SyncProvider
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
 * @property syncProvider Sources proposed Discogs tag values for DISCOGS_SYNC plans (story #817).
 */
class ChangePlanFacade(
    private val planService: ChangePlanService,
    private val store: ChangePlanStore,
    private val syncProvider: SyncProvider,
) {

    /**
     * Computes and stores a dry-run plan for [operation] over the given [albumIds].
     *
     * - [ChangeOperation.RELAYOUT]: plans directory relocations.
     * - [ChangeOperation.DISCOGS_SYNC]: sources proposed tag values from [syncProvider] per album
     *   and diffs them against current values. Per-album problems (no Discogs token, image quota,
     *   missing album, no Discogs id) are carried as [PlanConflict]s rather than failing the request,
     *   so one bad album in a batch never sinks the others (#819 depends on this).
     * - [ChangeOperation.RETAG]: the generic create-plan request carries only operation + albumIds
     *   and no proposed field values, so a manual retag cannot be planned here. Manual retagging
     *   flows through `PATCH /albums/{id}/tags`, which writes via the same shared FLAC tag-write
     *   path. RETAG via this generic endpoint therefore signals an unavailable operation (422).
     *
     * @param operation The bulk operation to plan.
     * @param albumIds The releases to include; must not be empty.
     * @return The stored consolidated plan.
     * @throws BusinessValidationException when [albumIds] is empty.
     * @throws OperationNotAvailableException when [operation] is [ChangeOperation.RETAG].
     */
    suspend fun createPlan(operation: ChangeOperation, albumIds: List<Uuid>): ChangePlan {
        if (albumIds.isEmpty()) {
            throw BusinessValidationException("albumIds must contain at least one album id")
        }
        val plan = when (operation) {
            ChangeOperation.RELAYOUT -> planService.planRelayout(albumIds)
            ChangeOperation.DISCOGS_SYNC -> planDiscogsSync(albumIds)
            ChangeOperation.RETAG -> throw OperationNotAvailableException(operation)
        }
        store.put(plan)
        logger.info {
            "change_plan_stored planId=${plan.id} operation=$operation releases=${plan.releases.size} " +
                "moves=${plan.totalMoves} tagChanges=${plan.totalTagChanges} conflicts=${plan.totalConflicts}"
        }
        return plan
    }

    private suspend fun planDiscogsSync(albumIds: List<Uuid>): ChangePlan {
        val proposedByAlbum = mutableMapOf<Uuid, Map<String, String>>()
        val currentByAlbum = mutableMapOf<Uuid, Map<String, String>>()
        val conflictsByAlbum = mutableMapOf<Uuid, List<PlanConflict>>()

        albumIds.distinct().forEach { albumId ->
            when (val outcome = previewAlbum(albumId)) {
                is PreviewOutcome.Success -> {
                    proposedByAlbum[albumId] = outcome.proposed
                    currentByAlbum[albumId] = outcome.current
                }
                is PreviewOutcome.Conflict -> {
                    conflictsByAlbum[albumId] = listOf(outcome.conflict)
                }
            }
        }

        return planService.planTagChanges(
            operation = ChangeOperation.DISCOGS_SYNC,
            proposedByAlbum = proposedByAlbum,
            currentByAlbum = currentByAlbum,
            conflictsByAlbum = conflictsByAlbum,
        )
    }

    private sealed interface PreviewOutcome {
        data class Success(val proposed: Map<String, String>, val current: Map<String, String>) : PreviewOutcome
        data class Conflict(val conflict: PlanConflict) : PreviewOutcome
    }

    @Suppress("TooGenericExceptionCaught") // one bad album must surface as a conflict, never sink the batch
    private suspend fun previewAlbum(albumId: Uuid): PreviewOutcome = try {
        val preview = syncProvider.preview(albumId)
        val proposed = preview.proposedChanges.associate { it.field to it.proposedValue }
        val current = preview.proposedChanges.associate { it.field to it.currentValue }
        PreviewOutcome.Success(proposed, current)
    } catch (ex: Exception) {
        logger.info { "discogs_plan_preview_conflict albumId=$albumId reason=${ex.message}" }
        PreviewOutcome.Conflict(
            PlanConflict(
                type = ConflictType.SOURCE_MISSING,
                albumId = albumId,
                path = null,
                message = ex.message ?: "Discogs preview failed for album $albumId",
            )
        )
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
