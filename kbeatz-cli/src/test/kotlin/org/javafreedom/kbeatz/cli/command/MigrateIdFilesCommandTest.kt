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
    fun `should exit cleanly when root has no subdirectories with id files`(@TempDir tempDir: java.nio.file.Path) {
        val result = MigrateIdFilesCommand().test("$tempDir")
        assertTrue(result.statusCode == 0)
        assertContains(result.output, "Migrated 0 files")
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
        assertTrue(Files.exists(album.resolve("metadata.yml")))
        assertContains(Files.readString(album.resolve("metadata.yml")), "discogs_id")
        assertContains(result.output, "WROTE")
        assertContains(result.output, "DEL")
        assertContains(result.output, "Migrated 1 files")
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
        MigrateIdFilesCommand().test("$tempDir")
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

    @Test
    fun `should skip directory where metadata yml already exists`(@TempDir tempDir: java.nio.file.Path) {
        val album = Files.createDirectory(tempDir.resolve("album"))
        Files.writeString(album.resolve("id.txt"), "[source]\ndiscogs_id=99\n")
        Files.writeString(album.resolve("metadata.yml"), "sources:\n  discogs_id: \"old\"\n")
        val result = MigrateIdFilesCommand().test("$tempDir")
        // original metadata.yml must remain unchanged
        assertContains(Files.readString(album.resolve("metadata.yml")), "discogs_id: \"old\"")
        assertContains(result.output, "SKIP")
        assertContains(result.output, "Migrated 0 files, 1 skipped")
    }

    @Test
    fun `should migrate one album and skip one when metadata yml already exists`(@TempDir tempDir: java.nio.file.Path) {
        val album1 = Files.createDirectory(tempDir.resolve("album1"))
        Files.writeString(album1.resolve("id.txt"), "[source]\ndiscogs_id=11\n")
        val album2 = Files.createDirectory(tempDir.resolve("album2"))
        Files.writeString(album2.resolve("id.txt"), "[source]\ndiscogs_id=22\n")
        Files.writeString(album2.resolve("metadata.yml"), "sources:\n  discogs_id: \"old\"\n")
        val result = MigrateIdFilesCommand().test("$tempDir")
        assertTrue(Files.exists(album1.resolve("metadata.yml")))
        assertContains(Files.readString(album2.resolve("metadata.yml")), "discogs_id: \"old\"")
        assertContains(result.output, "Migrated 1 files, 1 skipped")
    }

    @Test
    fun `should write metadata yml in dry-run output`(@TempDir tempDir: java.nio.file.Path) {
        val album = Files.createDirectory(tempDir.resolve("album"))
        Files.writeString(album.resolve("id.txt"), "[source]\ndiscogs_id=33\n")
        val result = MigrateIdFilesCommand().test("--dry-run $tempDir")
        assertContains(result.output, "DRY")
        assertFalse(Files.exists(album.resolve("metadata.yml")))
    }

    // --- Exit code tests ---

    @Test
    fun `resolveExitCode returns normally when no errors occurred`() {
        val cmd = MigrateIdFilesCommand()
        // Should not throw ProgramResult
        cmd.resolveExitCode(migrated = 1, errors = 0)
        cmd.resolveExitCode(migrated = 0, errors = 0)
    }

    @Test
    fun `resolveExitCode throws ProgramResult with code 1 when all operations fail`() {
        val cmd = MigrateIdFilesCommand()
        val ex = kotlin.test.assertFailsWith<com.github.ajalt.clikt.core.ProgramResult> {
            cmd.resolveExitCode(migrated = 0, errors = 2)
        }
        assertTrue(ex.statusCode == ExitCodes.FAILURE, "Expected exit code 1 but got ${ex.statusCode}")
    }

    @Test
    fun `resolveExitCode throws ProgramResult with code 3 for partial failure`() {
        val cmd = MigrateIdFilesCommand()
        val ex = kotlin.test.assertFailsWith<com.github.ajalt.clikt.core.ProgramResult> {
            cmd.resolveExitCode(migrated = 5, errors = 2)
        }
        assertTrue(ex.statusCode == ExitCodes.PARTIAL_FAILURE, "Expected exit code 3 but got ${ex.statusCode}")
    }

    @Test
    fun `should exit with code 0 when all albums migrated successfully`(@TempDir tempDir: java.nio.file.Path) {
        val album = Files.createDirectory(tempDir.resolve("album"))
        Files.writeString(album.resolve("id.txt"), "[source]\ndiscogs_id=11\n")
        val result = MigrateIdFilesCommand().test("$tempDir")
        assertTrue(result.statusCode == ExitCodes.SUCCESS, "Expected exit code 0 but got ${result.statusCode}")
    }
}
