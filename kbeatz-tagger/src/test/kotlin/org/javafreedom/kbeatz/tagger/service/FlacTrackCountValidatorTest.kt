package org.javafreedom.kbeatz.tagger.service

import kotlinx.io.files.Path
import org.javafreedom.kbeatz.common.FlacTrackCountMismatchException
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Files
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class FlacTrackCountValidatorTest {

    @Test
    fun `should not throw when FLAC file count matches expected track count`(@TempDir tempDir: java.nio.file.Path) {
        val discDir = tempDir.resolve("cd1").also { Files.createDirectory(it) }
        repeat(10) { i -> Files.write(discDir.resolve("track-${i + 1}.flac"), ByteArray(0)) }
        val albumDir = Path(tempDir.toString())

        FlacTrackCountValidator.validate(albumDir, Path(discDir.toString()), discNumber = 1, expectedTrackCount = 10)
        // no exception thrown - success
    }

    @Test
    fun `should throw FlacTrackCountMismatchException when disc has fewer FLAC files than expected`(
        @TempDir tempDir: java.nio.file.Path,
    ) {
        val discDir = tempDir.resolve("cd1").also { Files.createDirectory(it) }
        repeat(9) { i -> Files.write(discDir.resolve("track-${i + 1}.flac"), ByteArray(0)) }
        val albumDir = Path(tempDir.toString())

        val ex = assertFailsWith<FlacTrackCountMismatchException> {
            FlacTrackCountValidator.validate(albumDir, Path(discDir.toString()), discNumber = 1, expectedTrackCount = 10)
        }

        assertEquals(albumDir.toString(), ex.albumDir)
        assertEquals(1, ex.discNumber)
        assertEquals(10, ex.expectedTracks)
        assertEquals(9, ex.actualFiles)
    }

    @Test
    fun `should throw FlacTrackCountMismatchException when disc has more FLAC files than expected`(
        @TempDir tempDir: java.nio.file.Path,
    ) {
        val discDir = tempDir.resolve("cd2").also { Files.createDirectory(it) }
        repeat(7) { i -> Files.write(discDir.resolve("track-${i + 1}.flac"), ByteArray(0)) }
        val albumDir = Path(tempDir.toString())

        val ex = assertFailsWith<FlacTrackCountMismatchException> {
            FlacTrackCountValidator.validate(albumDir, Path(discDir.toString()), discNumber = 2, expectedTrackCount = 5)
        }

        assertEquals(2, ex.discNumber)
        assertEquals(5, ex.expectedTracks)
        assertEquals(7, ex.actualFiles)
    }

    @Test
    fun `exception message should suggest verifying metadata disc assignment`(@TempDir tempDir: java.nio.file.Path) {
        val discDir = tempDir.resolve("cd1").also { Files.createDirectory(it) }
        Files.write(discDir.resolve("track-01.flac"), ByteArray(0))
        val albumDir = Path(tempDir.toString())

        val ex = assertFailsWith<FlacTrackCountMismatchException> {
            FlacTrackCountValidator.validate(albumDir, Path(discDir.toString()), discNumber = 1, expectedTrackCount = 3)
        }

        assert(ex.message?.contains("metadata.yml", ignoreCase = true) == true) {
            "Expected exception message to mention metadata.yml but was: ${ex.message}"
        }
    }

    @Test
    fun `should not throw for single-disc album where FLAC count matches track count`(
        @TempDir tempDir: java.nio.file.Path,
    ) {
        // baseline: no regression for single-disc happy path
        repeat(5) { i -> Files.write(tempDir.resolve("track-${i + 1}.flac"), ByteArray(0)) }
        val albumDir = Path(tempDir.toString())

        FlacTrackCountValidator.validate(albumDir, albumDir, discNumber = 1, expectedTrackCount = 5)
        // no exception thrown - success
    }

    @Test
    fun `should only count FLAC files and ignore other file types`(@TempDir tempDir: java.nio.file.Path) {
        val discDir = tempDir.resolve("cd1").also { Files.createDirectory(it) }
        Files.write(discDir.resolve("track-01.flac"), ByteArray(0))
        Files.write(discDir.resolve("track-02.flac"), ByteArray(0))
        Files.write(discDir.resolve("cover.jpg"), ByteArray(0))
        Files.write(discDir.resolve("notes.txt"), ByteArray(0))
        Files.write(discDir.resolve("metadata.yml"), ByteArray(0))
        val albumDir = Path(tempDir.toString())

        // Should count only 2 FLAC files, ignoring jpg/txt/yml
        FlacTrackCountValidator.validate(albumDir, Path(discDir.toString()), discNumber = 1, expectedTrackCount = 2)
        // no exception thrown - success
    }

    @Test
    fun `should throw with zero actual files when disc directory is empty`(@TempDir tempDir: java.nio.file.Path) {
        val discDir = tempDir.resolve("cd1").also { Files.createDirectory(it) }
        val albumDir = Path(tempDir.toString())

        val ex = assertFailsWith<FlacTrackCountMismatchException> {
            FlacTrackCountValidator.validate(albumDir, Path(discDir.toString()), discNumber = 1, expectedTrackCount = 10)
        }

        assertEquals(0, ex.actualFiles)
        assertEquals(10, ex.expectedTracks)
    }

    @Test
    fun `FlacTrackCountMismatchException should be a DomainException`(@TempDir tempDir: java.nio.file.Path) {
        val discDir = tempDir.resolve("cd1").also { Files.createDirectory(it) }
        val albumDir = Path(tempDir.toString())

        val ex = assertFailsWith<FlacTrackCountMismatchException> {
            FlacTrackCountValidator.validate(albumDir, Path(discDir.toString()), discNumber = 1, expectedTrackCount = 5)
        }

        assert(ex is org.javafreedom.kbeatz.common.DomainException) {
            "FlacTrackCountMismatchException should extend DomainException"
        }
    }
}
