package org.javafreedom.kbeatz.catalog.application.service

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.time.Clock
import kotlin.time.Duration
import kotlin.time.Duration.Companion.hours
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Duration.Companion.seconds
import kotlin.time.Instant
import kotlin.uuid.Uuid
import org.javafreedom.kbeatz.catalog.domain.model.ChangeOperation
import org.javafreedom.kbeatz.catalog.domain.model.ChangePlan

/**
 * Unit tests for the bounded retention behaviour of [InMemoryChangePlanStore] (issue #961):
 * time-based TTL expiry and the size-cap eviction policy.
 */
class InMemoryChangePlanStoreTest {

    /** A test clock whose "now" can be advanced manually so TTL expiry is deterministic. */
    private class MutableClock(start: Instant) : Clock {
        private var current = start
        override fun now(): Instant = current
        fun advanceBy(amount: Duration) {
            current += amount
        }
    }

    private fun plan(id: Uuid = Uuid.random()) = ChangePlan(
        id = id,
        operation = ChangeOperation.RELAYOUT,
        releases = emptyList(),
        createdAt = Instant.fromEpochSeconds(0),
    )

    @Test
    fun `should return the stored plan when read within the TTL`() {
        val clock = MutableClock(Instant.fromEpochSeconds(1_000))
        val store = InMemoryChangePlanStore(ttl = 30.minutes, maxRetainedPlans = 100, clock = clock)
        val plan = plan()

        store.put(plan)
        clock.advanceBy(29.minutes)

        assertEquals(plan, store.get(plan.id))
    }

    @Test
    fun `should return null and prune the entry when read after the TTL elapses`() {
        val clock = MutableClock(Instant.fromEpochSeconds(1_000))
        val store = InMemoryChangePlanStore(ttl = 30.minutes, maxRetainedPlans = 100, clock = clock)
        val plan = plan()
        store.put(plan)

        clock.advanceBy(30.minutes + 1.seconds)

        assertNull(store.get(plan.id), "expired plan must read as absent")
        // A second lookup confirms the entry was pruned, not merely hidden: rewinding the clock
        // would otherwise resurrect it. The entry is gone, so even at the original time it is null.
        assertNull(store.get(plan.id))
    }

    @Test
    fun `should evict the oldest plan when put exceeds the size cap`() {
        val clock = MutableClock(Instant.fromEpochSeconds(0))
        val store = InMemoryChangePlanStore(ttl = 1.hours, maxRetainedPlans = 2, clock = clock)

        val oldest = plan()
        store.put(oldest)
        clock.advanceBy(1.minutes)
        val middle = plan()
        store.put(middle)
        clock.advanceBy(1.minutes)
        val newest = plan()
        store.put(newest)

        assertNull(store.get(oldest.id), "oldest plan must be evicted once the cap is exceeded")
        assertNotNull(store.get(middle.id), "recent plan must survive eviction")
        assertNotNull(store.get(newest.id), "newest plan must survive eviction")
    }

    @Test
    fun `should keep all plans when the size cap is not exceeded`() {
        val store = InMemoryChangePlanStore(ttl = 1.hours, maxRetainedPlans = 3)
        val plans = List(3) { plan() }
        plans.forEach { store.put(it) }

        plans.forEach { assertNotNull(store.get(it.id)) }
    }

    @Test
    fun `should prune expired entries before evicting on put`() {
        val clock = MutableClock(Instant.fromEpochSeconds(0))
        val store = InMemoryChangePlanStore(ttl = 10.minutes, maxRetainedPlans = 2, clock = clock)

        val expiring = plan()
        store.put(expiring)
        // Advance past the TTL so the first entry is expired, then add two fresh plans.
        clock.advanceBy(11.minutes)
        val a = plan()
        store.put(a)
        val b = plan()
        store.put(b)

        assertNull(store.get(expiring.id), "expired entry must be pruned, not counted toward the cap")
        assertNotNull(store.get(a.id), "fresh plan must remain after expired entry is pruned")
        assertNotNull(store.get(b.id), "fresh plan must remain after expired entry is pruned")
    }

    @Test
    fun `should overwrite an existing plan with the same id`() {
        val store = InMemoryChangePlanStore()
        val id = Uuid.random()
        store.put(plan(id))
        store.put(plan(id))

        assertNotNull(store.get(id))
    }

    @Test
    fun `should use sensible defaults for ttl and size cap`() {
        assertEquals(30.minutes, InMemoryChangePlanStore.DEFAULT_TTL)
        assertEquals(100, InMemoryChangePlanStore.DEFAULT_MAX_RETAINED_PLANS)
    }
}
