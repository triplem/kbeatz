package org.javafreedom.kbeatz.catalog.domain.service

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class TagDiffCalculatorTest {

    private val targetPath = "/srv/music/Miles Davis/Kind of Blue"

    @Test
    fun `should report no changes when current and proposed are equal`() {
        val tags = mapOf("ALBUM" to "Kind of Blue", "ALBUMARTIST" to "Miles Davis")

        val result = TagDiffCalculator.diff(tags, tags, targetPath)

        assertTrue(result.isEmpty())
    }

    @Test
    fun `should report no changes when both maps are empty`() {
        val result = TagDiffCalculator.diff(emptyMap(), emptyMap(), targetPath)

        assertTrue(result.isEmpty())
    }

    @Test
    fun `should report a change when a field value differs`() {
        val current = mapOf("ALBUM" to "Kind of Blue")
        val proposed = mapOf("ALBUM" to "Kind Of Blue")

        val result = TagDiffCalculator.diff(current, proposed, targetPath)

        assertEquals(1, result.size)
        val change = result.single()
        assertEquals(targetPath, change.targetPath)
        assertEquals("ALBUM", change.field)
        assertEquals("Kind of Blue", change.currentValue)
        assertEquals("Kind Of Blue", change.proposedValue)
    }

    @Test
    fun `should report an addition with null current value`() {
        val current = mapOf("ALBUM" to "Kind of Blue")
        val proposed = mapOf("ALBUM" to "Kind of Blue", "GENRE" to "Jazz")

        val result = TagDiffCalculator.diff(current, proposed, targetPath)

        val change = result.single()
        assertEquals("GENRE", change.field)
        assertEquals(null, change.currentValue)
        assertEquals("Jazz", change.proposedValue)
    }

    @Test
    fun `should report a removal with null proposed value`() {
        val current = mapOf("ALBUM" to "Kind of Blue", "GENRE" to "Jazz")
        val proposed = mapOf("ALBUM" to "Kind of Blue")

        val result = TagDiffCalculator.diff(current, proposed, targetPath)

        val change = result.single()
        assertEquals("GENRE", change.field)
        assertEquals("Jazz", change.currentValue)
        assertEquals(null, change.proposedValue)
    }

    @Test
    fun `should sort changes by field name for deterministic ordering`() {
        val current = mapOf("ZETA" to "1", "ALPHA" to "1", "MIKE" to "1")
        val proposed = mapOf("ZETA" to "2", "ALPHA" to "2", "MIKE" to "2")

        val result = TagDiffCalculator.diff(current, proposed, targetPath)

        assertEquals(listOf("ALPHA", "MIKE", "ZETA"), result.map { it.field })
    }

    @Test
    fun `should combine additions removals and changes in one diff`() {
        val current = mapOf("ALBUM" to "Old", "REMOVED" to "x")
        val proposed = mapOf("ALBUM" to "New", "ADDED" to "y")

        val result = TagDiffCalculator.diff(current, proposed, targetPath)

        assertEquals(3, result.size)
        assertEquals(listOf("ADDED", "ALBUM", "REMOVED"), result.map { it.field })
        assertEquals(null to "y", result[0].currentValue to result[0].proposedValue)
        assertEquals("Old" to "New", result[1].currentValue to result[1].proposedValue)
        assertEquals("x" to null, result[2].currentValue to result[2].proposedValue)
    }
}
