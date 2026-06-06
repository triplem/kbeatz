package org.javafreedom.kbeatz.cli.util

import kotlinx.io.files.Path
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Files
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class FileUtilsTest {

    @Test
    fun `should return empty sequence when maxDepth is zero`(@TempDir tempDir: java.nio.file.Path) {
        Files.createDirectory(tempDir.resolve("sub"))
        val result = walkDirectories(Path(tempDir.toString()), 0).toList()
        assertTrue(result.isEmpty())
    }

    @Test
    fun `should return direct child directories at depth one`(@TempDir tempDir: java.nio.file.Path) {
        Files.createDirectory(tempDir.resolve("a"))
        Files.createDirectory(tempDir.resolve("b"))
        tempDir.resolve("file.txt").also { Files.writeString(it, "x") }
        val result = walkDirectories(Path(tempDir.toString()), 1).toList()
        assertEquals(2, result.size)
        assertTrue(result.any { it.name == "a" })
        assertTrue(result.any { it.name == "b" })
    }

    @Test
    fun `should recurse into nested directories at depth two`(@TempDir tempDir: java.nio.file.Path) {
        val parent = Files.createDirectory(tempDir.resolve("parent"))
        Files.createDirectory(parent.resolve("child"))
        val result = walkDirectories(Path(tempDir.toString()), 2).toList()
        assertEquals(2, result.size)
    }

    @Test
    fun `should not recurse beyond maxDepth`(@TempDir tempDir: java.nio.file.Path) {
        val a = Files.createDirectory(tempDir.resolve("a"))
        val b = Files.createDirectory(a.resolve("b"))
        Files.createDirectory(b.resolve("c"))
        val result = walkDirectories(Path(tempDir.toString()), 2).toList()
        assertEquals(2, result.size)
    }

    @Test
    fun `should handle empty root directory`(@TempDir tempDir: java.nio.file.Path) {
        val result = walkDirectories(Path(tempDir.toString()), 3).toList()
        assertTrue(result.isEmpty())
    }
}
