package org.javafreedom.kbeatz.catalog.domain.model

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import kotlin.time.Instant
import kotlin.uuid.Uuid

class ChangePlanTest {

    private val createdAt = Instant.parse("2026-06-20T10:00:00Z")

    private fun move(albumId: Uuid) =
        DirectoryMove(albumId = albumId, fromPath = "/from", toPath = "/to")

    private fun tagChange(field: String) =
        TagChange(targetPath = "/p", field = field, currentValue = "a", proposedValue = "b")

    private fun conflict(albumId: Uuid) =
        PlanConflict(ConflictType.TARGET_EXISTS, albumId, "/to", "exists")

    @Test
    fun `release change set reports conflicts presence`() {
        val id = Uuid.random()
        val without = ReleaseChangeSet(id, null, emptyList(), emptyList())
        val with = ReleaseChangeSet(id, null, emptyList(), listOf(conflict(id)))

        assertFalse(without.hasConflicts)
        assertTrue(with.hasConflicts)
    }

    @Test
    fun `change plan aggregates moves tag changes and conflicts`() {
        val a = Uuid.random()
        val b = Uuid.random()
        val releaseA = ReleaseChangeSet(a, move(a), listOf(tagChange("ALBUM")), listOf(conflict(a)))
        val releaseB = ReleaseChangeSet(b, null, listOf(tagChange("GENRE"), tagChange("DATE")), emptyList())
        val plan = ChangePlan(Uuid.random(), ChangeOperation.RETAG, listOf(releaseA, releaseB), createdAt)

        assertEquals(1, plan.totalMoves)
        assertEquals(3, plan.totalTagChanges)
        assertEquals(1, plan.totalConflicts)
        assertTrue(plan.hasConflicts)
    }

    @Test
    fun `change plan reports no conflicts when none present`() {
        val a = Uuid.random()
        val release = ReleaseChangeSet(a, move(a), emptyList(), emptyList())
        val plan = ChangePlan(Uuid.random(), ChangeOperation.RELAYOUT, listOf(release), createdAt)

        assertFalse(plan.hasConflicts)
        assertEquals(0, plan.totalConflicts)
        assertEquals(1, plan.totalMoves)
    }
}
