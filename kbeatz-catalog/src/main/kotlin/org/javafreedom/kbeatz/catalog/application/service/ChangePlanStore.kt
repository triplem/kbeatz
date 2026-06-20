package org.javafreedom.kbeatz.catalog.application.service

import java.util.concurrent.ConcurrentHashMap
import kotlin.time.Clock
import kotlin.time.Duration
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Instant
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
 * In-memory [ChangePlanStore] backed by a [ConcurrentHashMap] with bounded retention (issue #961).
 *
 * Plans live only for the lifetime of the process. This matches v1 expectations: a plan is
 * computed, reviewed, then applied within a single session on a trusted LAN deployment.
 *
 * To prevent unbounded growth two limits are enforced:
 *
 * - **Time-based TTL**: an entry older than [ttl] is treated as absent ([get] returns null and
 *   prunes it). The creation time is taken from the injected [clock], so tests can advance time
 *   and observe expiry deterministically.
 * - **Size cap**: at most [maxRetainedPlans] entries are retained. When [put] would exceed the
 *   cap, expired entries are pruned first, then the oldest remaining entries are evicted until
 *   the store is back under the cap.
 *
 * Reads and writes use a [ConcurrentHashMap]; the prune/evict step is synchronised on [lock] so a
 * concurrent [put] cannot race two eviction passes against each other.
 *
 * @property ttl How long a stored plan remains retrievable after it was put.
 * @property maxRetainedPlans The maximum number of plans retained at once.
 * @property clock Time source for stamping and expiring entries; injected for testability.
 */
class InMemoryChangePlanStore(
    private val ttl: Duration = DEFAULT_TTL,
    private val maxRetainedPlans: Int = DEFAULT_MAX_RETAINED_PLANS,
    private val clock: Clock = Clock.System,
) : ChangePlanStore {

    private data class Entry(val plan: ChangePlan, val storedAt: Instant)

    private val plans = ConcurrentHashMap<Uuid, Entry>()
    private val lock = Any()

    override fun put(plan: ChangePlan) {
        plans[plan.id] = Entry(plan, clock.now())
        enforceLimits()
    }

    override fun get(id: Uuid): ChangePlan? {
        val entry = plans[id] ?: return null
        return if (isExpired(entry)) {
            plans.remove(id, entry)
            null
        } else {
            entry.plan
        }
    }

    private fun isExpired(entry: Entry): Boolean = clock.now() - entry.storedAt >= ttl

    /** Prunes expired entries, then evicts oldest entries until the size cap is satisfied. */
    private fun enforceLimits() {
        synchronized(lock) {
            plans.entries.removeIf { isExpired(it.value) }
            if (plans.size <= maxRetainedPlans) return
            val overflow = plans.size - maxRetainedPlans
            plans.entries
                .sortedBy { it.value.storedAt }
                .take(overflow)
                .forEach { plans.remove(it.key, it.value) }
        }
    }

    companion object {
        /** Default time-to-live for a retained plan (issue #961). */
        val DEFAULT_TTL: Duration = 30.minutes

        /** Default maximum number of retained plans (issue #961). */
        const val DEFAULT_MAX_RETAINED_PLANS: Int = 100
    }
}
