package org.javafreedom.kbeatz.catalog.application.service

import java.util.concurrent.ConcurrentHashMap
import kotlin.uuid.Uuid
import org.javafreedom.kbeatz.catalog.domain.model.ChangePlan

/**
 * Stores computed [ChangePlan]s by id so a plan produced by a dry run (story #815) can be
 * retrieved later and applied by id (story #816).
 *
 * Implementations must be safe for concurrent access from multiple request coroutines.
 */
interface ChangePlanStore {
    /** Stores [plan], overwriting any existing plan with the same id. */
    fun put(plan: ChangePlan)

    /** Returns the plan with the given [id], or null when no such plan is stored. */
    fun get(id: Uuid): ChangePlan?
}

/**
 * In-memory [ChangePlanStore] backed by a [ConcurrentHashMap].
 *
 * Plans live only for the lifetime of the process. This matches v1 expectations: a plan is
 * computed, reviewed, then applied within a single session on a trusted LAN deployment.
 */
class InMemoryChangePlanStore : ChangePlanStore {
    private val plans = ConcurrentHashMap<Uuid, ChangePlan>()

    override fun put(plan: ChangePlan) {
        plans[plan.id] = plan
    }

    override fun get(id: Uuid): ChangePlan? = plans[id]
}
