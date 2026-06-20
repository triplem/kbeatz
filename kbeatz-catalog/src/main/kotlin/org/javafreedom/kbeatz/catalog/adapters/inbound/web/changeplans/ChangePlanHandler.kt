package org.javafreedom.kbeatz.catalog.adapters.inbound.web.changeplans

import io.github.oshai.kotlinlogging.KotlinLogging
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlin.uuid.Uuid
import org.javafreedom.kbeatz.catalog.api.models.ChangePlan as ApiChangePlan
import org.javafreedom.kbeatz.catalog.api.models.ChangePlanOperation as ApiChangePlanOperation
import org.javafreedom.kbeatz.catalog.api.models.CreateChangePlanRequest
import org.javafreedom.kbeatz.catalog.api.models.DirectoryMove as ApiDirectoryMove
import org.javafreedom.kbeatz.catalog.api.models.ErrorResponse
import org.javafreedom.kbeatz.catalog.api.models.PlanConflict as ApiPlanConflict
import org.javafreedom.kbeatz.catalog.api.models.ReleaseChangeSet as ApiReleaseChangeSet
import org.javafreedom.kbeatz.catalog.api.models.TagChange as ApiTagChange
import org.javafreedom.kbeatz.catalog.application.service.ChangePlanFacade
import org.javafreedom.kbeatz.catalog.application.service.OperationNotAvailableException
import org.javafreedom.kbeatz.catalog.domain.model.ChangeOperation
import org.javafreedom.kbeatz.catalog.domain.model.ChangePlan
import org.javafreedom.kbeatz.catalog.domain.model.ConflictType
import org.javafreedom.kbeatz.catalog.domain.model.DirectoryMove
import org.javafreedom.kbeatz.catalog.domain.model.PlanConflict
import org.javafreedom.kbeatz.catalog.domain.model.ReleaseChangeSet
import org.javafreedom.kbeatz.catalog.domain.model.TagChange
import org.javafreedom.kbeatz.common.BusinessValidationException

private val log = KotlinLogging.logger {}

/**
 * Ktor route handlers for dry-run change plans (story #815).
 *
 * - `POST /change-plans` computes and stores a consolidated dry-run plan.
 * - `GET /change-plans/{planId}` retrieves a stored plan by id.
 *
 * Planning performs zero disk writes. Conflicts are returned inside the plan body as data,
 * never as request failures. No auth in v1 (trusted LAN deployment).
 */
fun Route.changePlanRoutes(facade: ChangePlanFacade) {
    post("/change-plans") {
        val request = runCatching { call.receive<CreateChangePlanRequest>() }.getOrNull()
        if (request == null) {
            call.respond(
                HttpStatusCode.BadRequest,
                ErrorResponse(code = "INVALID_REQUEST", message = "Malformed or missing request body"),
            )
            return@post
        }
        handleCreate(call, facade, request)
    }

    get("/change-plans/{planId}") {
        val planIdStr = call.parameters["planId"]
        val planId = planIdStr?.let { runCatching { Uuid.parse(it) }.getOrNull() }
        when {
            planIdStr == null -> call.respond(
                HttpStatusCode.BadRequest,
                ErrorResponse(code = "INVALID_PLAN_ID", message = "Missing planId parameter"),
            )
            planId == null -> call.respond(
                HttpStatusCode.BadRequest,
                ErrorResponse(code = "INVALID_PLAN_ID", message = "Invalid UUID: $planIdStr"),
            )
            else -> {
                val plan = facade.getPlan(planId)
                if (plan == null) {
                    call.respond(
                        HttpStatusCode.NotFound,
                        ErrorResponse(code = "RESOURCE_NOT_FOUND", message = "Change plan not found"),
                    )
                } else {
                    call.respond(HttpStatusCode.OK, plan.toApiModel())
                }
            }
        }
    }
}

private suspend fun handleCreate(
    call: ApplicationCall,
    facade: ChangePlanFacade,
    request: CreateChangePlanRequest,
) {
    val albumIds = request.albumIds.map { it to runCatching { Uuid.parse(it) }.getOrNull() }
    val invalid = albumIds.firstOrNull { it.second == null }?.first
    if (invalid != null) {
        call.respond(
            HttpStatusCode.BadRequest,
            ErrorResponse(code = "INVALID_ALBUM_ID", message = "Invalid UUID: $invalid"),
        )
        return
    }
    val operation = request.operation.toDomain()
    try {
        val plan = facade.createPlan(operation, albumIds.map { it.second!! })
        call.response.headers.append(HttpHeaders.Location, "/change-plans/${plan.id}")
        call.respond(HttpStatusCode.Created, plan.toApiModel())
    } catch (ex: OperationNotAvailableException) {
        log.info { "change_plan_operation_unavailable operation=$operation" }
        call.respond(
            HttpStatusCode.UnprocessableEntity,
            ErrorResponse(code = "OPERATION_NOT_AVAILABLE", message = ex.message ?: "Operation not available"),
        )
    } catch (ex: BusinessValidationException) {
        call.respond(
            HttpStatusCode.BadRequest,
            ErrorResponse(code = "INVALID_REQUEST", message = ex.message ?: "Invalid request"),
        )
    }
}

private fun ApiChangePlanOperation.toDomain(): ChangeOperation = when (this) {
    ApiChangePlanOperation.RELAYOUT -> ChangeOperation.RELAYOUT
    ApiChangePlanOperation.RETAG -> ChangeOperation.RETAG
    ApiChangePlanOperation.DISCOGS_SYNC -> ChangeOperation.DISCOGS_SYNC
}

internal fun ChangePlan.toApiModel(): ApiChangePlan = ApiChangePlan(
    id = id.toString(),
    operation = operation.toApiOperation(),
    releases = releases.map { it.toApiReleaseChangeSet() },
    createdAt = createdAt.toString(),
    totalMoves = totalMoves,
    totalTagChanges = totalTagChanges,
    totalConflicts = totalConflicts,
    hasConflicts = hasConflicts,
)

private fun ChangeOperation.toApiOperation(): ApiChangePlanOperation = when (this) {
    ChangeOperation.RELAYOUT -> ApiChangePlanOperation.RELAYOUT
    ChangeOperation.RETAG -> ApiChangePlanOperation.RETAG
    ChangeOperation.DISCOGS_SYNC -> ApiChangePlanOperation.DISCOGS_SYNC
}

private fun ReleaseChangeSet.toApiReleaseChangeSet(): ApiReleaseChangeSet = ApiReleaseChangeSet(
    albumId = albumId.toString(),
    tagChanges = tagChanges.map { it.toApiTagChange() },
    conflicts = conflicts.map { it.toApiPlanConflict() },
    hasConflicts = hasConflicts,
    directoryMove = directoryMove?.toApiDirectoryMove(),
)

private fun DirectoryMove.toApiDirectoryMove(): ApiDirectoryMove = ApiDirectoryMove(
    albumId = albumId.toString(),
    fromPath = fromPath,
    toPath = toPath,
    mergedFromPaths = mergedFromPaths,
)

private fun TagChange.toApiTagChange(): ApiTagChange = ApiTagChange(
    targetPath = targetPath,
    field = field,
    currentValue = currentValue,
    proposedValue = proposedValue,
)

private fun PlanConflict.toApiPlanConflict(): ApiPlanConflict = ApiPlanConflict(
    type = type.toApiConflictType(),
    albumId = albumId.toString(),
    message = message,
    path = path,
)

private fun ConflictType.toApiConflictType(): ApiPlanConflict.Type = when (this) {
    ConflictType.TARGET_EXISTS -> ApiPlanConflict.Type.TARGET_EXISTS
    ConflictType.PATH_TRAVERSAL -> ApiPlanConflict.Type.PATH_TRAVERSAL
    ConflictType.SOURCE_MISSING -> ApiPlanConflict.Type.SOURCE_MISSING
    ConflictType.LOCK_HELD -> ApiPlanConflict.Type.LOCK_HELD
}
