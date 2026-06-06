package org.javafreedom.kbeatz.cli.command

import com.github.ajalt.clikt.testing.test
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Files
import kotlin.test.assertContains

class TagAlbumsCommandTest {

    @Test
    fun `should report no albums found when library root has no id files`(@TempDir tempDir: java.nio.file.Path) {
        val result = TagAlbumsCommand().test("--library $tempDir")
        assertContains(result.output, "No album directories found")
    }

    @Test
    fun `should skip directory with no id file when passed directly`(@TempDir tempDir: java.nio.file.Path) {
        val result = TagAlbumsCommand().test("$tempDir")
        assertContains(result.output, "SKIP")
        assertContains(result.output, "no id.txt")
    }

    @Test
    fun `should skip directory when id file has no discogs_id`(@TempDir tempDir: java.nio.file.Path) {
        Files.writeString(tempDir.resolve("id.txt"), "[source]\namg_id=99\n")
        val result = TagAlbumsCommand().test("$tempDir")
        assertContains(result.output, "SKIP")
        assertContains(result.output, "no discogs_id")
    }

    @Test
    fun `should print DRY output when dry-run flag set and discogs_id present`(@TempDir tempDir: java.nio.file.Path) {
        Files.writeString(tempDir.resolve("id.txt"), "[source]\ndiscogs_id=12345\n")
        val result = TagAlbumsCommand().test("--dry-run $tempDir")
        assertContains(result.output, "DRY")
        assertContains(result.output, "discogs_id=12345")
    }

    @Test
    fun `should print TODO output without dry-run when discogs_id present`(@TempDir tempDir: java.nio.file.Path) {
        Files.writeString(tempDir.resolve("id.txt"), "[source]\ndiscogs_id=42\n")
        val result = TagAlbumsCommand().test("$tempDir")
        assertContains(result.output, "TODO")
        assertContains(result.output, "discogs_id=42")
    }

    @Test
    fun `should process album found in library root via --library option`(@TempDir tempDir: java.nio.file.Path) {
        val album = Files.createDirectory(tempDir.resolve("album"))
        Files.writeString(album.resolve("id.txt"), "[source]\ndiscogs_id=77\n")
        val result = TagAlbumsCommand().test("--library $tempDir --dry-run")
        assertContains(result.output, "DRY")
        assertContains(result.output, "discogs_id=77")
    }

    @Test
    fun `should scan recursively when --recursive flag set`(@TempDir tempDir: java.nio.file.Path) {
        val nested = Files.createDirectories(tempDir.resolve("genre/artist/album"))
        Files.writeString(nested.resolve("id.txt"), "[source]\ndiscogs_id=55\n")
        val result = TagAlbumsCommand().test("--library $tempDir --recursive --dry-run")
        assertContains(result.output, "DRY")
        assertContains(result.output, "discogs_id=55")
    }

    @Test
    fun `should pick up metadata yml as id file`(@TempDir tempDir: java.nio.file.Path) {
        Files.writeString(tempDir.resolve("metadata.yml"), "sources:\n  discogs_id: \"999\"\n")
        val result = TagAlbumsCommand().test("--dry-run $tempDir")
        assertContains(result.output, "DRY")
        assertContains(result.output, "discogs_id=999")
    }
}
