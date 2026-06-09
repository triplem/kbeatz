package org.javafreedom.kbeatz.cli.command

import com.github.ajalt.clikt.testing.test
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.io.files.Path
import org.javafreedom.kbeatz.tagger.service.TagResult
import org.javafreedom.kbeatz.tagger.service.TaggerService
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Files
import kotlin.test.assertContains
import kotlin.test.assertTrue

class TagAlbumsCommandTest {

    @Test
    fun `should exit cleanly when library root has no id files`(@TempDir tempDir: java.nio.file.Path) {
        val result = TagAlbumsCommand().test("--library $tempDir")
        assertTrue(result.statusCode == 0)
        assertContains(result.output, "No album directories found.")
    }

    @Test
    fun `should exit cleanly when directory passed directly has no id file`(@TempDir tempDir: java.nio.file.Path) {
        val result = TagAlbumsCommand().test("$tempDir")
        assertTrue(result.statusCode == 0)
    }

    @Test
    fun `should skip directory when id file has no discogs_id`(@TempDir tempDir: java.nio.file.Path) {
        // IniIdFileParser returns null for INI files without discogs_id →
        // reader sees no parseable id file → "no id file found" warning via logger
        Files.writeString(tempDir.resolve("id.txt"), "[source]\namg_id=99\n")
        val result = TagAlbumsCommand().test("$tempDir")
        assertTrue(result.statusCode == 0)
    }

    @Test
    fun `should print DRY output when dry-run flag set and discogs_id present`(@TempDir tempDir: java.nio.file.Path) {
        Files.writeString(tempDir.resolve("id.txt"), "[source]\ndiscogs_id=12345\n")
        val result = TagAlbumsCommand().test("--dry-run $tempDir")
        assertContains(result.output, "DRY")
        assertContains(result.output, "discogs_id=12345")
    }

    @Test
    fun `should tag album when service tags successfully`(@TempDir tempDir: java.nio.file.Path) {
        Files.writeString(tempDir.resolve("id.txt"), "[source]\ndiscogs_id=42\n")
        val mockService = mockk<TaggerService>()
        coEvery { mockService.tagAlbum(any(), any()) } returns
            TagResult.Tagged(Path(tempDir.toString()), "42", 3)
        val result = TagAlbumsCommand(taggerServiceOverride = mockService).test("$tempDir")
        assertTrue(result.statusCode == 0)
        assertContains(result.output, "TAGGED")
    }

    @Test
    fun `should write metadata yml after tagging when service returns Tagged`(@TempDir tempDir: java.nio.file.Path) {
        Files.writeString(tempDir.resolve("id.txt"), "[source]\ndiscogs_id=42\n")
        val mockService = mockk<TaggerService>()
        coEvery { mockService.tagAlbum(any(), any()) } returns
            TagResult.Tagged(Path(tempDir.toString()), "42", 3)
        TagAlbumsCommand(taggerServiceOverride = mockService).test("$tempDir")
        assertTrue(Files.exists(tempDir.resolve("metadata.yml")))
    }

    @Test
    fun `should exit cleanly when service returns Skipped`(@TempDir tempDir: java.nio.file.Path) {
        Files.writeString(tempDir.resolve("id.txt"), "[source]\ndiscogs_id=42\n")
        val mockService = mockk<TaggerService>()
        coEvery { mockService.tagAlbum(any(), any()) } returns
            TagResult.Skipped(Path(tempDir.toString()), "release not found")
        val result = TagAlbumsCommand(taggerServiceOverride = mockService).test("$tempDir")
        assertTrue(result.statusCode == 0)
        assertContains(result.output, "SKIP")
    }

    @Test
    fun `should exit with code 1 when service returns Failed for single target`(@TempDir tempDir: java.nio.file.Path) {
        Files.writeString(tempDir.resolve("id.txt"), "[source]\ndiscogs_id=42\n")
        val mockService = mockk<TaggerService>()
        coEvery { mockService.tagAlbum(any(), any()) } returns
            TagResult.Failed(Path(tempDir.toString()), RuntimeException("network error"))
        val result = TagAlbumsCommand(taggerServiceOverride = mockService).test("$tempDir")
        assertTrue(result.statusCode == ExitCodes.FAILURE, "Expected exit code 1 but got ${result.statusCode}")
        assertContains(result.stderr, "ERROR")
        assertContains(result.stderr, "network error")
    }

    @Test
    fun `should process album found in library root via --library option`(@TempDir tempDir: java.nio.file.Path) {
        val album = Files.createDirectory(tempDir.resolve("album"))
        Files.writeString(album.resolve("id.txt"), "[source]\ndiscogs_id=77\n")
        val result = TagAlbumsCommand().test("--library $tempDir --dry-run")
        assertContains(result.output, "DRY")
        assertContains(result.output, "discogs_id=77")
        assertContains(result.output, "Tagging [1/1]")
        assertContains(result.output, "Tagged 1 albums")
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

    @Test
    fun `should write metadata yml after tagging from legacy id txt`(@TempDir tempDir: java.nio.file.Path) {
        Files.writeString(tempDir.resolve("id.txt"), "[source]\ndiscogs_id=42\n")
        val mockService = mockk<TaggerService>()
        coEvery { mockService.tagAlbum(any(), any()) } returns
            TagResult.Tagged(Path(tempDir.toString()), "42", 1)
        TagAlbumsCommand(taggerServiceOverride = mockService).test("$tempDir")
        assertTrue(Files.exists(tempDir.resolve("metadata.yml")))
        assertContains(Files.readString(tempDir.resolve("metadata.yml")), "discogs_id: \"42\"")
    }

    @Test
    fun `should write metadata yml after tagging from local_ids txt`(@TempDir tempDir: java.nio.file.Path) {
        Files.writeString(tempDir.resolve("local_ids.txt"), "[source]\ndiscogs_id=55\n")
        val mockService = mockk<TaggerService>()
        coEvery { mockService.tagAlbum(any(), any()) } returns
            TagResult.Tagged(Path(tempDir.toString()), "55", 2)
        TagAlbumsCommand(taggerServiceOverride = mockService).test("$tempDir")
        assertTrue(Files.exists(tempDir.resolve("metadata.yml")))
        assertContains(Files.readString(tempDir.resolve("metadata.yml")), "discogs_id: \"55\"")
    }

    @Test
    fun `should not overwrite existing metadata yml after tagging`(@TempDir tempDir: java.nio.file.Path) {
        val existingContent = "sources:\n  discogs_id: \"old\"\n"
        Files.writeString(tempDir.resolve("id.txt"), "[source]\ndiscogs_id=42\n")
        Files.writeString(tempDir.resolve("metadata.yml"), existingContent)
        val mockService = mockk<TaggerService>()
        coEvery { mockService.tagAlbum(any(), any()) } returns
            TagResult.Tagged(Path(tempDir.toString()), "42", 1)
        TagAlbumsCommand(taggerServiceOverride = mockService).test("$tempDir")
        assertContains(Files.readString(tempDir.resolve("metadata.yml")), "discogs_id: \"old\"")
    }

    @Test
    fun `should exit cleanly when processing single album with no id file`(@TempDir tempDir: java.nio.file.Path) {
        val result = TagAlbumsCommand().test("$tempDir")
        assertTrue(result.statusCode == 0)
    }

    @Test
    fun `should produce DRY output for library album and exit cleanly`(@TempDir tempDir: java.nio.file.Path) {
        val album = Files.createDirectory(tempDir.resolve("album"))
        Files.writeString(album.resolve("id.txt"), "[source]\ndiscogs_id=77\n")
        val result = TagAlbumsCommand().test("--library $tempDir --dry-run")
        assertContains(result.output, "DRY")
        assertTrue(result.statusCode == 0)
    }

    @Test
    fun `should scan at custom depth when --depth option is given`(@TempDir tempDir: java.nio.file.Path) {
        // album at depth 2 — should be found with --depth 2
        val level1 = Files.createDirectory(tempDir.resolve("genre"))
        val album = Files.createDirectory(level1.resolve("album"))
        Files.writeString(album.resolve("id.txt"), "[source]\ndiscogs_id=99\n")
        val result = TagAlbumsCommand().test("--library $tempDir --depth 2 --dry-run")
        assertContains(result.output, "DRY")
        assertContains(result.output, "discogs_id=99")
    }

    @Test
    fun `should not scan beyond --depth`(@TempDir tempDir: java.nio.file.Path) {
        // album at depth 4 — should NOT be found with --depth 3
        val deep = Files.createDirectories(tempDir.resolve("a/b/c/d"))
        Files.writeString(deep.resolve("id.txt"), "[source]\ndiscogs_id=77\n")
        val result = TagAlbumsCommand().test("--library $tempDir --depth 3 --dry-run")
        assertTrue(result.statusCode == 0)
        assertTrue("DRY" !in result.output)
    }

    @Test
    fun `should find album with id file via library scan`(@TempDir tempDir: java.nio.file.Path) {
        val noId = Files.createDirectory(tempDir.resolve("no-id"))
        val hasId = Files.createDirectory(tempDir.resolve("has-id"))
        Files.writeString(hasId.resolve("id.txt"), "[source]\ndiscogs_id=55\n")
        // The "no-id" dir has no id file so won't appear in resolveTargets —
        // but "has-id" dir will be found and DRY-tagged
        val result = TagAlbumsCommand().test("--library $tempDir --dry-run")
        assertContains(result.output, "DRY")
        assertContains(result.output, "discogs_id=55")
        assertTrue(noId.toFile().isDirectory) // directory still exists
    }

    // --- Exit code tests ---

    @Test
    fun `resolveExitCode returns normally when no errors occurred`() {
        val cmd = TagAlbumsCommand()
        // Should not throw ProgramResult
        cmd.resolveExitCode(isBatchMode = false, tagged = 1, errors = 0)
        cmd.resolveExitCode(isBatchMode = true, tagged = 5, errors = 0)
    }

    @Test
    fun `resolveExitCode throws ProgramResult with code 1 for single-target failure`() {
        val cmd = TagAlbumsCommand()
        val ex = kotlin.test.assertFailsWith<com.github.ajalt.clikt.core.ProgramResult> {
            cmd.resolveExitCode(isBatchMode = false, tagged = 0, errors = 1)
        }
        assertTrue(ex.statusCode == ExitCodes.FAILURE, "Expected exit code 1 but got ${ex.statusCode}")
    }

    @Test
    fun `resolveExitCode throws ProgramResult with code 1 when all batch albums fail`() {
        val cmd = TagAlbumsCommand()
        val ex = kotlin.test.assertFailsWith<com.github.ajalt.clikt.core.ProgramResult> {
            cmd.resolveExitCode(isBatchMode = true, tagged = 0, errors = 3)
        }
        assertTrue(ex.statusCode == ExitCodes.FAILURE, "Expected exit code 1 but got ${ex.statusCode}")
    }

    @Test
    fun `resolveExitCode throws ProgramResult with code 3 for partial batch failure`() {
        val cmd = TagAlbumsCommand()
        val ex = kotlin.test.assertFailsWith<com.github.ajalt.clikt.core.ProgramResult> {
            cmd.resolveExitCode(isBatchMode = true, tagged = 97, errors = 3)
        }
        assertTrue(ex.statusCode == ExitCodes.PARTIAL_FAILURE, "Expected exit code 3 but got ${ex.statusCode}")
    }

    @Test
    fun `should exit with code 0 when all library albums tag successfully`(@TempDir tempDir: java.nio.file.Path) {
        val album = Files.createDirectory(tempDir.resolve("album"))
        Files.writeString(album.resolve("id.txt"), "[source]\ndiscogs_id=42\n")
        val mockService = mockk<TaggerService>()
        coEvery { mockService.tagAlbum(any(), any()) } returns
            TagResult.Tagged(Path(album.toString()), "42", 2)
        val result = TagAlbumsCommand(taggerServiceOverride = mockService).test("--library $tempDir")
        assertTrue(result.statusCode == ExitCodes.SUCCESS, "Expected exit code 0 but got ${result.statusCode}")
    }

    @Test
    fun `should exit with code 3 when some library albums fail in batch mode`(@TempDir tempDir: java.nio.file.Path) {
        val album1 = Files.createDirectory(tempDir.resolve("album1"))
        Files.writeString(album1.resolve("id.txt"), "[source]\ndiscogs_id=10\n")
        val album2 = Files.createDirectory(tempDir.resolve("album2"))
        Files.writeString(album2.resolve("id.txt"), "[source]\ndiscogs_id=20\n")
        val mockService = mockk<TaggerService>()
        coEvery { mockService.tagAlbum(Path(album1.toString()), any()) } returns
            TagResult.Tagged(Path(album1.toString()), "10", 1)
        coEvery { mockService.tagAlbum(Path(album2.toString()), any()) } returns
            TagResult.Failed(Path(album2.toString()), RuntimeException("api error"))
        val result = TagAlbumsCommand(taggerServiceOverride = mockService).test("--library $tempDir")
        assertTrue(result.statusCode == ExitCodes.PARTIAL_FAILURE, "Expected exit code 3 but got ${result.statusCode}")
        assertContains(result.stderr, "api error")
    }

    @Test
    fun `should exit with code 1 when all library albums fail in batch mode`(@TempDir tempDir: java.nio.file.Path) {
        val album = Files.createDirectory(tempDir.resolve("album"))
        Files.writeString(album.resolve("id.txt"), "[source]\ndiscogs_id=10\n")
        val mockService = mockk<TaggerService>()
        coEvery { mockService.tagAlbum(any(), any()) } returns
            TagResult.Failed(Path(album.toString()), RuntimeException("total failure"))
        val result = TagAlbumsCommand(taggerServiceOverride = mockService).test("--library $tempDir")
        assertTrue(result.statusCode == ExitCodes.FAILURE, "Expected exit code 1 but got ${result.statusCode}")
    }
}
