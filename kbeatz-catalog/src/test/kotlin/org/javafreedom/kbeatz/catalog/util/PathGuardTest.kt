package org.javafreedom.kbeatz.catalog.util

import java.nio.file.Files
import java.nio.file.Path
import kotlin.test.Test
import kotlin.test.assertFailsWith
import kotlin.test.assertIs
import org.junit.jupiter.api.io.TempDir

/**
 * Unit tests for [PathGuard.assertWithinLibraryRoot].
 *
 * Tests cover:
 * - A path that exists and is inside the root (ok).
 * - A path that exists and is outside the root (throws).
 * - A symlink inside the root that points outside the root (throws).
 * - A path that does not yet exist (uses normalize; ok when within root).
 */
class PathGuardTest {

    @TempDir
    lateinit var root: Path

    @TempDir
    lateinit var outside: Path

    @Test
    fun `should succeed when existing path is inside library root`() {
        val insideDir = Files.createTempDirectory(root, "album")
        PathGuard.assertWithinLibraryRoot(insideDir, root)
    }

    @Test
    fun `should throw SecurityException when existing path is outside library root`() {
        val outsideDir = Files.createTempDirectory(outside, "secret")
        assertFailsWith<SecurityException> {
            PathGuard.assertWithinLibraryRoot(outsideDir, root)
        }
    }

    @Test
    fun `should throw SecurityException for symlink inside root pointing outside`() {
        val target = Files.createTempDirectory(outside, "real-dir")
        val link = root.resolve("symlink-dir")
        Files.createSymbolicLink(link, target)

        val ex = assertFailsWith<SecurityException> {
            PathGuard.assertWithinLibraryRoot(link, root)
        }
        assertIs<SecurityException>(ex)
    }

    @Test
    fun `should succeed for non-existent path that is lexically within root`() {
        val notYetCreated = root.resolve("new-album-dir")
        // Path does not exist; PathGuard should fall back to normalize()
        PathGuard.assertWithinLibraryRoot(notYetCreated, root)
    }

    @Test
    fun `should throw SecurityException for non-existent path with traversal sequence`() {
        val traversal = root.resolve("../escape")
        assertFailsWith<SecurityException> {
            PathGuard.assertWithinLibraryRoot(traversal, root)
        }
    }
}
