package org.javafreedom.kbeatz.catalog.infrastructure.tag

import java.nio.file.Files
import java.nio.file.Path
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import kotlin.uuid.Uuid
import kotlinx.io.files.Path as KtPath
import org.javafreedom.kbeatz.catalog.domain.model.WRITE_LOCK_FILENAME
import org.javafreedom.kbeatz.common.ConflictException
import org.javafreedom.kbeatz.common.PathTraversalException
import org.javafreedom.kbeatz.tagger.codec.flac.FlacFile

/**
 * Unit tests for [FlacTagWriter], the single atomic FLAC tag-write path (story #817).
 *
 * Writes are exercised against real FLAC files copied from the `with-tags.flac` fixture so the
 * full FlacFile.read() + writeTo() round-trip runs, then tags are read back to confirm the write.
 */
class FlacTagWriterTest {

    private val libraryRoot: Path = Files.createTempDirectory("flac-tag-writer-root")
    private val writer = FlacTagWriter(libraryRoot)
    private val albumId = Uuid.random()

    @AfterTest
    fun cleanUp() {
        libraryRoot.toFile().deleteRecursively()
    }

    private fun copyFixture(dest: Path) {
        val resource = checkNotNull(
            FlacTagWriterTest::class.java.classLoader.getResource("with-tags.flac"),
        ) { "with-tags.flac fixture not found in test resources" }
        Files.copy(Path.of(resource.toURI()), dest)
    }

    private fun tagValue(flac: Path, field: String): String? =
        FlacFile.read(KtPath(flac.toString())).vorbisComment
            ?.comments
            ?.firstOrNull { it.substringBefore('=').equals(field, ignoreCase = true) }
            ?.substringAfter('=')

    @Test
    fun `writeAlbumFields writes fields to primary and merged directories and removes the lock`() {
        val primaryDir = Files.createTempDirectory(libraryRoot, "primary")
        val mergedDir = Files.createTempDirectory(libraryRoot, "merged")
        val primaryFlac = primaryDir.resolve("01.flac")
        val mergedFlac = mergedDir.resolve("01.flac")
        copyFixture(primaryFlac)
        copyFixture(mergedFlac)

        writer.writeAlbumFields(
            albumId = albumId,
            primaryDir = primaryDir,
            mergedDirs = listOf(mergedDir.toString()),
            fields = mapOf("GENRE" to "Bebop", "LABEL" to "Blue Note"),
        )

        assertEquals("Bebop", tagValue(primaryFlac, "GENRE"))
        assertEquals("Blue Note", tagValue(primaryFlac, "LABEL"))
        assertEquals("Bebop", tagValue(mergedFlac, "GENRE"))
        assertEquals("Blue Note", tagValue(mergedFlac, "LABEL"))
        assertFalse(
            Files.exists(primaryDir.resolve(WRITE_LOCK_FILENAME)),
            "Write-lock manifest must be removed after a successful write",
        )
    }

    @Test
    fun `writeAlbumFields throws ConflictException when a write-lock is already held`() {
        val primaryDir = Files.createTempDirectory(libraryRoot, "primary")
        copyFixture(primaryDir.resolve("01.flac"))
        Files.writeString(primaryDir.resolve(WRITE_LOCK_FILENAME), "cli-write-in-progress")

        assertFailsWith<ConflictException> {
            writer.writeAlbumFields(albumId, primaryDir, emptyList(), mapOf("GENRE" to "Jazz"))
        }
    }

    @Test
    fun `writeAlbumFields throws PathTraversalException for a directory outside the library root`() {
        val outside = Files.createTempDirectory("outside-root")
        try {
            assertFailsWith<PathTraversalException> {
                writer.writeAlbumFields(albumId, outside, emptyList(), mapOf("GENRE" to "Jazz"))
            }
        } finally {
            outside.toFile().deleteRecursively()
        }
    }

    @Test
    fun `writeAlbumFields does not create a lock when the directory has no FLAC files`() {
        val primaryDir = Files.createTempDirectory(libraryRoot, "empty")

        writer.writeAlbumFields(albumId, primaryDir, emptyList(), mapOf("GENRE" to "Jazz"))

        assertFalse(Files.exists(primaryDir.resolve(WRITE_LOCK_FILENAME)))
    }

    @Test
    fun `writeAlbumFields retains the lock on failure when removeLockOnFailure is false`() {
        val primaryDir = Files.createTempDirectory(libraryRoot, "primary")
        // A 4-byte fLaC marker with no blocks fails on parse, so the write throws mid-batch.
        Files.write(primaryDir.resolve("01.flac"), byteArrayOf(0x66, 0x4C, 0x61, 0x43))

        runCatching {
            writer.writeAlbumFields(
                albumId = albumId,
                primaryDir = primaryDir,
                mergedDirs = emptyList(),
                fields = mapOf("GENRE" to "Jazz"),
                removeLockOnFailure = false,
            )
        }

        assertTrue(
            Files.exists(primaryDir.resolve(WRITE_LOCK_FILENAME)),
            "Lock must be retained on failure so startup repair can detect the partial write",
        )
    }

    @Test
    fun `writeSingleFile writes the field to one file without a manifest`() {
        val primaryDir = Files.createTempDirectory(libraryRoot, "primary")
        val flac = primaryDir.resolve("01.flac")
        copyFixture(flac)

        writer.writeSingleFile(flac, mapOf("TITLE" to "So What"))

        assertEquals("So What", tagValue(flac, "TITLE"))
        assertFalse(Files.exists(primaryDir.resolve(WRITE_LOCK_FILENAME)))
    }

    @Test
    fun `writeSingleFile throws PathTraversalException for a file outside the library root`() {
        val outside = Files.createTempDirectory("outside-root")
        val flac = outside.resolve("01.flac")
        copyFixtureOutside(flac)
        try {
            assertFailsWith<PathTraversalException> {
                writer.writeSingleFile(flac, mapOf("TITLE" to "x"))
            }
        } finally {
            outside.toFile().deleteRecursively()
        }
    }

    private fun copyFixtureOutside(dest: Path) {
        val resource = checkNotNull(
            FlacTagWriterTest::class.java.classLoader.getResource("with-tags.flac"),
        ) { "with-tags.flac fixture not found in test resources" }
        Files.copy(Path.of(resource.toURI()), dest)
    }
}
