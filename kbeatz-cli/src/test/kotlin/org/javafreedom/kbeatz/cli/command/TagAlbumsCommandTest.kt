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
    fun `should report no albums found when library root has no id files`(@TempDir tempDir: java.nio.file.Path) {
        val result = TagAlbumsCommand().test("--library $tempDir")
        assertContains(result.output, "No album directories found")
    }

    @Test
    fun `should skip directory with no id file when passed directly`(@TempDir tempDir: java.nio.file.Path) {
        val result = TagAlbumsCommand().test("$tempDir")
        assertContains(result.output, "WARN")
        assertContains(result.output, "no id file found")
    }

    @Test
    fun `should skip directory when id file has no discogs_id`(@TempDir tempDir: java.nio.file.Path) {
        // IniIdFileParser returns null for INI files without discogs_id →
        // reader sees no parseable id file → "no id file found" warning
        Files.writeString(tempDir.resolve("id.txt"), "[source]\namg_id=99\n")
        val result = TagAlbumsCommand().test("$tempDir")
        assertContains(result.output, "WARN")
        assertContains(result.output, "no id file found")
    }

    @Test
    fun `should print DRY output when dry-run flag set and discogs_id present`(@TempDir tempDir: java.nio.file.Path) {
        Files.writeString(tempDir.resolve("id.txt"), "[source]\ndiscogs_id=12345\n")
        val result = TagAlbumsCommand().test("--dry-run $tempDir")
        assertContains(result.output, "DRY")
        assertContains(result.output, "discogs_id=12345")
    }

    @Test
    fun `should print TAGGED output when service tags successfully`(@TempDir tempDir: java.nio.file.Path) {
        Files.writeString(tempDir.resolve("id.txt"), "[source]\ndiscogs_id=42\n")
        val mockService = mockk<TaggerService>()
        coEvery { mockService.tagAlbum(any(), any()) } returns
            TagResult.Tagged(Path(tempDir.toString()), "42", 3)
        val result = TagAlbumsCommand(taggerServiceOverride = mockService).test("$tempDir")
        assertContains(result.output, "TAGGED")
        assertContains(result.output, "3 FLAC files")
    }

    @Test
    fun `should print SKIP from service when service returns Skipped`(@TempDir tempDir: java.nio.file.Path) {
        Files.writeString(tempDir.resolve("id.txt"), "[source]\ndiscogs_id=42\n")
        val mockService = mockk<TaggerService>()
        coEvery { mockService.tagAlbum(any(), any()) } returns
            TagResult.Skipped(Path(tempDir.toString()), "release not found")
        val result = TagAlbumsCommand(taggerServiceOverride = mockService).test("$tempDir")
        assertContains(result.output, "SKIP")
        assertContains(result.output, "release not found")
    }

    @Test
    fun `should print ERROR when service returns Failed`(@TempDir tempDir: java.nio.file.Path) {
        Files.writeString(tempDir.resolve("id.txt"), "[source]\ndiscogs_id=42\n")
        val mockService = mockk<TaggerService>()
        coEvery { mockService.tagAlbum(any(), any()) } returns
            TagResult.Failed(Path(tempDir.toString()), RuntimeException("network error"))
        val result = TagAlbumsCommand(taggerServiceOverride = mockService).test("$tempDir")
        assertContains(result.output, "ERROR")
        assertContains(result.output, "network error")
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
    fun `should include skip warning in summary output`(@TempDir tempDir: java.nio.file.Path) {
        val result = TagAlbumsCommand().test("$tempDir")
        assertContains(result.output, "WARN")
        assertContains(result.output, "skipped")
    }
}
