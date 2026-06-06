package org.javafreedom.kbeatz.cli.command

import com.github.ajalt.clikt.testing.test
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Files
import kotlin.test.assertContains
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class MigrateIdFilesCommandTest {

    @Test
    fun `should produce no output when root has no subdirectories with id files`(@TempDir tempDir: java.nio.file.Path) {
        val result = MigrateIdFilesCommand().test("$tempDir")
        assertTrue(result.output.isBlank())
    }

    @Test
    fun `should print DRY output and not write metadata yml in dry-run mode`(@TempDir tempDir: java.nio.file.Path) {
        val album = Files.createDirectory(tempDir.resolve("album"))
        Files.writeString(album.resolve("id.txt"), "[source]\ndiscogs_id=11\n")
        val result = MigrateIdFilesCommand().test("--dry-run $tempDir")
        assertContains(result.output, "DRY")
        assertFalse(Files.exists(album.resolve("metadata.yml")))
    }

    @Test
    fun `should write metadata yml when not in dry-run mode`(@TempDir tempDir: java.nio.file.Path) {
        val album = Files.createDirectory(tempDir.resolve("album"))
        Files.writeString(album.resolve("id.txt"), "[source]\ndiscogs_id=22\n")
        val result = MigrateIdFilesCommand().test("$tempDir")
        assertContains(result.output, "WROTE")
        assertTrue(Files.exists(album.resolve("metadata.yml")))
        assertContains(Files.readString(album.resolve("metadata.yml")), "discogs_id")
    }

    @Test
    fun `should delete original id file after migration by default`(@TempDir tempDir: java.nio.file.Path) {
        val album = Files.createDirectory(tempDir.resolve("album"))
        Files.writeString(album.resolve("id.txt"), "[source]\ndiscogs_id=33\n")
        MigrateIdFilesCommand().test("$tempDir")
        assertFalse(Files.exists(album.resolve("id.txt")))
        assertTrue(Files.exists(album.resolve("metadata.yml")))
    }

    @Test
    fun `should keep original id file when --keep-original flag set`(@TempDir tempDir: java.nio.file.Path) {
        val album = Files.createDirectory(tempDir.resolve("album"))
        Files.writeString(album.resolve("id.txt"), "[source]\ndiscogs_id=44\n")
        MigrateIdFilesCommand().test("--keep-original $tempDir")
        assertTrue(Files.exists(album.resolve("id.txt")))
        assertTrue(Files.exists(album.resolve("metadata.yml")))
    }

    @Test
    fun `should delete local_ids txt alongside id txt when both present`(@TempDir tempDir: java.nio.file.Path) {
        val album = Files.createDirectory(tempDir.resolve("album"))
        Files.writeString(album.resolve("id.txt"), "[source]\ndiscogs_id=55\n")
        Files.writeString(album.resolve("local_ids.txt"), "[source]\ndiscogs_id=55\n")
        val result = MigrateIdFilesCommand().test("$tempDir")
        assertContains(result.output, "DEL")
        assertFalse(Files.exists(album.resolve("local_ids.txt")))
    }

    @Test
    fun `should scan nested directories when --recursive flag set`(@TempDir tempDir: java.nio.file.Path) {
        val nested = Files.createDirectories(tempDir.resolve("artist/album"))
        Files.writeString(nested.resolve("id.txt"), "[source]\ndiscogs_id=66\n")
        val result = MigrateIdFilesCommand().test("--recursive --dry-run $tempDir")
        assertContains(result.output, "DRY")
    }

    @Test
    fun `should produce valid yaml from id file sources`(@TempDir tempDir: java.nio.file.Path) {
        val album = Files.createDirectory(tempDir.resolve("album"))
        Files.writeString(album.resolve("id.txt"), "[source]\ndiscogs_id=77\namg_id=88\n")
        MigrateIdFilesCommand().test("$tempDir")
        val yaml = Files.readString(album.resolve("metadata.yml"))
        assertContains(yaml, "sources:")
        assertContains(yaml, "discogs_id: \"77\"")
        assertContains(yaml, "amg_id: \"88\"")
    }
}
