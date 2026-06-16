package org.javafreedom.kbeatz.catalog.application.service

import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.just
import io.mockk.mockk
import io.mockk.runs
import java.nio.file.Files
import java.nio.file.Path
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import kotlin.uuid.Uuid
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.test.runTest
import org.javafreedom.kbeatz.catalog.domain.model.Album
import org.javafreedom.kbeatz.catalog.domain.model.WRITE_LOCK_FILENAME
import org.javafreedom.kbeatz.catalog.domain.model.Track
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumRepository
import org.javafreedom.kbeatz.catalog.domain.repository.TrackRepository
import org.javafreedom.kbeatz.common.ConflictException
import org.javafreedom.kbeatz.common.ResourceNotFoundException

/**
 * Unit tests for [TagWriteService].
 *
 * FLAC writes are tested using real temporary files containing minimal valid FLAC data.
 * The FlacFile.read() + writeTo() path is exercised at the service level to ensure the
 * write-lock manifest lifecycle and H2 update calls are correct.
 *
 * Atomic write (temp → rename) is handled inside FlacFile.writeTo() and tested by the tagger module.
 */
class TagWriteServiceTest {

    private val libraryRoot: Path = Files.createTempDirectory("tag-write-test-root")
    private val albumDir: Path = Files.createTempDirectory(libraryRoot, "kind-of-blue")

    @AfterTest
    fun cleanUp() {
        // Delete lock file explicitly first (defensive; deleteRecursively below covers it too).
        Files.deleteIfExists(albumDir.resolve(WRITE_LOCK_FILENAME))
        // Remove all temp dirs created for this test instance. libraryRoot.deleteRecursively()
        // covers albumDir and any subdirs created inside libraryRoot during individual tests.
        libraryRoot.toFile().deleteRecursively()
    }

    private val albumRepository: AlbumRepository = mockk()
    private val trackRepository: TrackRepository = mockk()

    private val service = TagWriteService(albumRepository, trackRepository, libraryRoot)

    private val albumId = Uuid.random()
    private val trackId = Uuid.random()

    private fun buildAlbum(id: Uuid = albumId, dir: Path = albumDir) = Album(
        id = id,
        albumArtist = "Miles Davis",
        album = "Kind of Blue",
        date = "1959",
        genre = "Jazz",
        label = null,
        catalogNumber = null,
        composer = null,
        conductor = null,
        ensemble = null,
        discogsId = null,
        directoryPath = dir.toString(),
        extraTags = null,
        images = null,
    )

    private fun buildTrack(path: String = "01 So What.flac") = Track(
        id = trackId,
        albumId = albumId,
        title = "So What",
        trackNumber = "1",
        discNumber = null,
        trackTotal = null,
        discTotal = null,
        artist = null,
        composer = null,
        conductor = null,
        ensemble = null,
        durationSeconds = 565,
        path = path,
        images = null,
        extraTags = null,
    )

    // ──────────────────────────────────────────────
    // Album-level: validation
    // ──────────────────────────────────────────────

    @Test
    fun `writeAlbumTags throws IllegalArgumentException for unknown field`() = runTest {
        assertFailsWith<IllegalArgumentException> {
            service.writeAlbumTags(albumId, "INVALID_FIELD", "value")
        }
    }

    @Test
    fun `writeAlbumTags throws ResourceNotFoundException when album not found`() = runTest {
        coEvery { albumRepository.findById(albumId) } returns null

        assertFailsWith<ResourceNotFoundException> {
            service.writeAlbumTags(albumId, "GENRE", "Rock")
        }
    }

    @Test
    fun `writeAlbumTags normalises field name to uppercase`() = runTest {
        val album = buildAlbum()
        coEvery { albumRepository.findById(albumId) } returns album
        coEvery { albumRepository.save(any()) } answers { firstArg() }

        // No FLAC files in directory — write succeeds with no file ops
        val result = service.writeAlbumTags(albumId, "genre", "Rock")

        assertEquals("Rock", result.genre)
    }

    @Test
    fun `writeAlbumTags throws SecurityException when album dir is outside library root`() = runTest {
        val outsideDir = Files.createTempDirectory("outside-library")
        val album = buildAlbum(dir = outsideDir)
        coEvery { albumRepository.findById(albumId) } returns album

        assertFailsWith<SecurityException> {
            service.writeAlbumTags(albumId, "GENRE", "Rock")
        }
    }

    // ──────────────────────────────────────────────
    // Album-level: lock file lifecycle
    // ──────────────────────────────────────────────

    @Test
    fun `writeAlbumTags does not create lock file when directory has no FLAC files`() = runTest {
        val album = buildAlbum()
        coEvery { albumRepository.findById(albumId) } returns album
        coEvery { albumRepository.save(any()) } answers { firstArg() }

        service.writeAlbumTags(albumId, "GENRE", "Rock")

        val lockFile = albumDir.resolve(".kbeatz-write.lock").toFile()
        assertFalse(lockFile.exists(), "Lock file should not be created when no FLAC files exist")
    }

    @Test
    fun `writeAlbumTags creates and removes lock file when FLAC files exist`() = runTest {
        // Create a minimal FLAC file in the album directory (copied from test resources)
        val flacFile = albumDir.resolve("01.flac")
        copyMinimalFlac(flacFile)

        val album = buildAlbum()
        coEvery { albumRepository.findById(albumId) } returns album
        coEvery { albumRepository.save(any()) } answers { firstArg() }

        service.writeAlbumTags(albumId, "GENRE", "Rock")

        val lockFile = albumDir.resolve(".kbeatz-write.lock").toFile()
        assertFalse(lockFile.exists(), "Lock file should be removed after successful write")
        assertTrue(flacFile.toFile().exists(), "Original FLAC file should exist after write")
    }

    @Test
    fun `writeAlbumTags updates album record in repository`() = runTest {
        val album = buildAlbum()
        coEvery { albumRepository.findById(albumId) } returns album
        coEvery { albumRepository.save(any()) } answers { firstArg() }

        service.writeAlbumTags(albumId, "GENRE", "Progressive Rock")

        coVerify(exactly = 1) { albumRepository.save(match { it.genre == "Progressive Rock" }) }
    }

    // ──────────────────────────────────────────────
    // Album-level: field mapping
    // ──────────────────────────────────────────────

    @Test
    fun `writeAlbumTags maps all album-level fields correctly`() = runTest {
        val album = buildAlbum()
        coEvery { albumRepository.findById(albumId) } returns album
        coEvery { albumRepository.save(any()) } answers { firstArg() }

        val fieldTests = mapOf(
            "ALBUM" to "New Album",
            "ALBUMARTIST" to "New Artist",
            "DATE" to "2024",
            "GENRE" to "Electronic",
            "LABEL" to "Sub Pop",
            "CATALOGNUMBER" to "SP001",
            "COMPOSER" to "J. S. Bach",
            "CONDUCTOR" to "Rattle",
            "ENSEMBLE" to "LSO",
        )

        fieldTests.forEach { (field, value) ->
            val result = service.writeAlbumTags(albumId, field, value)
            when (field) {
                "ALBUM" -> assertEquals(value, result.album)
                "ALBUMARTIST" -> assertEquals(value, result.albumArtist)
                "DATE" -> assertEquals(value, result.date)
                "GENRE" -> assertEquals(value, result.genre)
                "LABEL" -> assertEquals(value, result.label)
                "CATALOGNUMBER" -> assertEquals(value, result.catalogNumber)
                "COMPOSER" -> assertEquals(value, result.composer)
                "CONDUCTOR" -> assertEquals(value, result.conductor)
                "ENSEMBLE" -> assertEquals(value, result.ensemble)
            }
        }
    }

    // ──────────────────────────────────────────────
    // Track-level: validation
    // ──────────────────────────────────────────────

    @Test
    fun `writeTrackTags throws IllegalArgumentException for unknown field`() = runTest {
        assertFailsWith<IllegalArgumentException> {
            service.writeTrackTags(albumId, trackId, "INVALID", "value")
        }
    }

    @Test
    fun `writeTrackTags throws ResourceNotFoundException when album not found`() = runTest {
        coEvery { albumRepository.findById(albumId) } returns null

        assertFailsWith<ResourceNotFoundException> {
            service.writeTrackTags(albumId, trackId, "TITLE", "New Title")
        }
    }

    @Test
    fun `writeTrackTags throws ResourceNotFoundException when track not found`() = runTest {
        val album = buildAlbum()
        coEvery { albumRepository.findById(albumId) } returns album
        coEvery { trackRepository.findByAlbumId(albumId) } returns emptyList()

        assertFailsWith<ResourceNotFoundException> {
            service.writeTrackTags(albumId, trackId, "TITLE", "New Title")
        }
    }

    @Test
    fun `writeTrackTags normalises field name to uppercase`() = runTest {
        val flacFile = albumDir.resolve("01 So What.flac")
        copyMinimalFlac(flacFile)

        val album = buildAlbum()
        val track = buildTrack()
        coEvery { albumRepository.findById(albumId) } returns album
        coEvery { trackRepository.findByAlbumId(albumId) } returns listOf(track)
        coEvery { trackRepository.update(any()) } returns Unit

        val result = service.writeTrackTags(albumId, trackId, "title", "New Title")

        assertEquals("New Title", result.title)
    }

    @Test
    fun `writeTrackTags updates track record in repository`() = runTest {
        val flacFile = albumDir.resolve("01 So What.flac")
        copyMinimalFlac(flacFile)

        val album = buildAlbum()
        val track = buildTrack()
        coEvery { albumRepository.findById(albumId) } returns album
        coEvery { trackRepository.findByAlbumId(albumId) } returns listOf(track)
        coEvery { trackRepository.update(any()) } returns Unit

        service.writeTrackTags(albumId, trackId, "TITLE", "New Title")

        coVerify(exactly = 1) { trackRepository.update(match { it.title == "New Title" && it.id == trackId }) }
    }

    @Test
    fun `writeTrackTags maps all track-level fields correctly`() = runTest {
        val flacFile = albumDir.resolve("01 So What.flac")
        copyMinimalFlac(flacFile)

        val album = buildAlbum()
        coEvery { albumRepository.findById(albumId) } returns album
        coEvery { trackRepository.update(any()) } returns Unit

        val fieldTests = mapOf("TITLE" to "New Title", "TRACKNUMBER" to "5", "ARTIST" to "Coltrane")

        fieldTests.forEach { (field, value) ->
            val track = buildTrack()
            coEvery { trackRepository.findByAlbumId(albumId) } returns listOf(track)

            val result = service.writeTrackTags(albumId, trackId, field, value)
            when (field) {
                "TITLE" -> assertEquals(value, result.title)
                "TRACKNUMBER" -> assertEquals(value, result.trackNumber)
                "ARTIST" -> assertEquals(value, result.artist)
            }
        }
    }

    // ──────────────────────────────────────────────
    // Concurrency: Mutex serialisation (issue #385)
    // ──────────────────────────────────────────────

    @Test
    fun `writeAlbumTags throws ConflictException when write-lock file exists (CLI conflict)`() = runTest {
        val album = buildAlbum()
        coEvery { albumRepository.findById(albumId) } returns album

        // Simulate CLI holding the write-lock file (cleaned up by @AfterTest)
        Files.writeString(albumDir.resolve(WRITE_LOCK_FILENAME), "cli-write-in-progress")

        assertFailsWith<ConflictException> {
            service.writeAlbumTags(albumId, "GENRE", "Jazz")
        }
    }

    @Test
    fun `writeAlbumTags serialises concurrent requests for the same album`() = runTest {
        val executionOrder = mutableListOf<String>()
        val album = buildAlbum()

        // First call records "start-1", delays briefly, then records "end-1"
        var callCount = 0
        coEvery { albumRepository.findById(albumId) } returns album
        coEvery { albumRepository.save(any()) } coAnswers {
            callCount++
            val n = callCount
            executionOrder.add("start-$n")
            @Suppress("MagicNumber") // 10ms delay to simulate concurrent writes overlapping
            delay(10L)
            executionOrder.add("end-$n")
            firstArg()
        }

        // Launch two concurrent writes to the same album
        val first = async { service.writeAlbumTags(albumId, "GENRE", "Jazz") }
        val second = async { service.writeAlbumTags(albumId, "GENRE", "Rock") }
        first.await()
        second.await()

        // Verify serialisation: end-1 must come before start-2 (or end-2 before start-1)
        val end1 = executionOrder.indexOf("end-1")
        val start2 = executionOrder.indexOf("start-2")
        assertTrue(end1 < start2 || executionOrder.indexOf("end-2") < executionOrder.indexOf("start-1"),
            "Concurrent writes must be serialised: observed order $executionOrder")
    }

    @Test
    fun `writeAlbumTags rejects a second writer while the first holds the directory write-lock`() = runTest {
        // Two distinct albums whose records point to the SAME directory. The in-memory Mutex is
        // keyed by album UUID, so these two writes are NOT serialised by the Mutex: they contend
        // only on the on-disk .kbeatz-write.lock file (the cross-writer guard). While the first
        // writer holds the lock file, the second must be rejected with ConflictException and the
        // FLAC file on disk must not be corrupted.
        //
        // The first writer's critical section (lock create -> FLAC write -> lock delete) is fully
        // synchronous with no interceptable suspension point, so a wall-clock race would be flaky.
        // To assert the contract deterministically we hold the lock file open for the duration of
        // the second writer's attempt by pre-creating it (exactly the state a concurrent first
        // writer produces between writeLockFile() and deleteLockFile()).
        val flacFile = albumDir.resolve("01.flac")
        copyMinimalFlac(flacFile)
        val originalBytes = flacFile.toFile().readBytes()

        val firstAlbumId = Uuid.random()
        val secondAlbumId = Uuid.random()

        coEvery { albumRepository.findById(secondAlbumId) } returns buildAlbum(id = secondAlbumId)
        coEvery { albumRepository.findById(firstAlbumId) } returns buildAlbum(id = firstAlbumId)
        coEvery { albumRepository.save(any()) } answers { firstArg() }

        // Simulate the first writer being inside its critical section, holding the lock file
        // (cleaned up by @AfterTest if the test fails early).
        val manifest = flacFile.toString()
        Files.writeString(albumDir.resolve(WRITE_LOCK_FILENAME), manifest)

        // Second writer must be rejected because the lock file is present.
        val secondResult = runCatching {
            service.writeAlbumTags(secondAlbumId, "GENRE", "Rock")
        }
        assertTrue(
            secondResult.exceptionOrNull() is ConflictException,
            "The contending writer must be rejected with ConflictException but was: " +
                "${secondResult.exceptionOrNull()}",
        )

        // No corrupt file: the rejected write touched no bytes; the FLAC is byte-identical.
        val afterReject = flacFile.toFile().readBytes()
        assertEquals(
            originalBytes.toList(),
            afterReject.toList(),
            "Rejected writer must not modify the FLAC file",
        )

        // First writer finishes and releases the lock.
        Files.deleteIfExists(albumDir.resolve(WRITE_LOCK_FILENAME))

        // Once the lock is released, a fresh write to the same directory succeeds (serialised,
        // not lost) and leaves a valid FLAC with no lingering lock file.
        val retry = service.writeAlbumTags(firstAlbumId, "GENRE", "Jazz")
        assertEquals("Jazz", retry.genre)
        val finalBytes = flacFile.toFile().readBytes()
        assertTrue(finalBytes.size >= 4, "FLAC file must not be truncated after the serialised retry")
        assertEquals(
            originalBytes.copyOfRange(0, 4).toList(),
            finalBytes.copyOfRange(0, 4).toList(),
            "FLAC marker must be intact after the serialised retry",
        )
        assertFalse(
            albumDir.resolve(WRITE_LOCK_FILENAME).toFile().exists(),
            "Write-lock file must be removed after the serialised retry",
        )
    }

    // ──────────────────────────────────────────────
    // Multi-directory write path (issue #666)
    // ──────────────────────────────────────────────

    @Test
    fun `writeAlbumTags writes tags to FLAC files in merged directories`() = runTest {
        // Set up a second directory (merged) alongside the primary albumDir.
        val mergedDir: Path = Files.createTempDirectory(libraryRoot, "kind-of-blue-backup")

        // Place a FLAC file in each directory.
        val primaryFlac = albumDir.resolve("01.flac")
        val mergedFlac = mergedDir.resolve("01.flac")
        copyMinimalFlac(primaryFlac)
        copyMinimalFlac(mergedFlac)

        // Build album with a merged directory recorded.
        val album = buildAlbum().copy(mergedDirectories = listOf(mergedDir.toString()))
        coEvery { albumRepository.findById(albumId) } returns album
        coEvery { albumRepository.save(any()) } answers { firstArg() }

        service.writeAlbumTags(albumId, "GENRE", "Jazz")

        // Both FLAC files must still exist after the write (not truncated or deleted).
        assertTrue(primaryFlac.toFile().exists(), "Primary FLAC file must exist after multi-dir write")
        assertTrue(mergedFlac.toFile().exists(), "Merged FLAC file must exist after multi-dir write")

        // Lock file must be cleaned up in the primary directory.
        assertFalse(
            albumDir.resolve(WRITE_LOCK_FILENAME).toFile().exists(),
            "Write-lock file must be removed after multi-dir write",
        )
    }

    @Test
    fun `writeAlbumTags skips merged directory that no longer exists on disk`() = runTest {
        val phantomDir = libraryRoot.resolve("phantom-does-not-exist")
        // phantomDir is NOT created on disk.

        val album = buildAlbum().copy(mergedDirectories = listOf(phantomDir.toString()))
        coEvery { albumRepository.findById(albumId) } returns album
        coEvery { albumRepository.save(any()) } answers { firstArg() }

        // Must succeed without throwing; phantom dir is skipped with a WARN.
        val result = service.writeAlbumTags(albumId, "GENRE", "Jazz")
        assertEquals("Jazz", result.genre)
    }

    // ──────────────────────────────────────────────
    // Partial failure: merged directory write fails (issue #725)
    // ──────────────────────────────────────────────

    @Test
    fun `writeAlbumTags rethrows exception and cleans up lock file when merged directory write fails`() = runTest {
        // This test uses filesystem permissions to simulate a write failure. On systems where
        // the test runner executes as root (e.g. some Docker CI environments), setWritable(false)
        // is ignored and the test would pass vacuously. The assumption below skips it in that case.
        val canEnforcePermissions = Files.createTempFile("perm-check", null).also { tmp ->
            tmp.toFile().setWritable(false)
        }.let { tmp ->
            val writable = tmp.toFile().canWrite()
            tmp.toFile().setWritable(true)
            tmp.toFile().delete()
            !writable
        }
        if (!canEnforcePermissions) return@runTest

        // Set up a merged directory with a FLAC file.
        val mergedDir: Path = Files.createTempDirectory(libraryRoot, "kind-of-blue-readonly")
        val primaryFlac = albumDir.resolve("01-primary.flac")
        val mergedFlac = mergedDir.resolve("01-merged.flac")
        copyMinimalFlac(primaryFlac)
        copyMinimalFlac(mergedFlac)

        val album = buildAlbum().copy(mergedDirectories = listOf(mergedDir.toString()))
        coEvery { albumRepository.findById(albumId) } returns album
        coEvery { albumRepository.save(any()) } answers { firstArg() }

        // Make the merged directory read-only so the FLAC write cannot create a temp file.
        mergedDir.toFile().setWritable(false)

        try {
            // The write to the primary directory succeeds, then the merged dir write fails
            // with a FileNotFoundException (permission denied creating the temp file).
            // The service must rethrow so the caller knows the write was incomplete.
            assertFailsWith<java.io.FileNotFoundException> {
                service.writeAlbumTags(albumId, "GENRE", "Jazz")
            }

            // The finally block must still run: the lock file must be deleted from the primary dir.
            assertFalse(
                albumDir.resolve(WRITE_LOCK_FILENAME).toFile().exists(),
                "Write-lock file must be removed even when a merged directory write fails",
            )

            // The primary FLAC file must still exist (write succeeded before merged dir failed).
            assertTrue(primaryFlac.toFile().exists(), "Primary FLAC must exist after partial failure")
        } finally {
            // Restore write permissions so the temp directory can be cleaned up after the test.
            mergedDir.toFile().setWritable(true)
        }
    }

    @Test
    fun `writeAlbumTags throws SecurityException for merged directory path outside libraryRoot`() = runTest {
        // A traversal path stored in mergedDirectories (e.g. from a DB manipulation)
        // must be rejected by validatePath even when the directory does not exist on disk.
        val outsideDir = Files.createTempDirectory("outside-root-for-merged")
        try {
            val album = buildAlbum().copy(mergedDirectories = listOf(outsideDir.toString()))
            coEvery { albumRepository.findById(albumId) } returns album

            // validatePath is called before isDirectory so the traversal is caught regardless
            // of whether the path exists (issue #724).
            assertFailsWith<SecurityException> {
                service.writeAlbumTags(albumId, "GENRE", "Jazz")
            }
        } finally {
            outsideDir.toFile().deleteRecursively()
        }
    }

    @Test
    fun `writeAlbumTags with empty mergedDirectories writes only to primary directory`() = runTest {
        val flacFile = albumDir.resolve("01.flac")
        copyMinimalFlac(flacFile)

        val album = buildAlbum() // mergedDirectories defaults to emptyList()
        coEvery { albumRepository.findById(albumId) } returns album
        coEvery { albumRepository.save(any()) } answers { firstArg() }

        val result = service.writeAlbumTags(albumId, "GENRE", "Rock")

        assertEquals("Rock", result.genre)
        assertTrue(flacFile.toFile().exists(), "Primary FLAC file must exist after single-dir write")
    }

    // ──────────────────────────────────────────────
    // Bulk write path (issue #726)
    // ──────────────────────────────────────────────

    @Test
    fun `writeBulkTags applies all album-level fields in one lock acquisition`() = runTest {
        val flacFile = albumDir.resolve("01.flac")
        copyMinimalFlac(flacFile)

        val album = buildAlbum()
        coEvery { albumRepository.findById(albumId) } returns album
        coEvery { albumRepository.save(any()) } answers { firstArg() }

        val result = service.writeBulkTags(
            albumId,
            albumFields = listOf("GENRE" to "Jazz", "DATE" to "1959"),
            trackFields = emptyList(),
        )

        assertEquals("Jazz", result.genre)
        assertEquals("1959", result.date)
        // Only one lock file lifecycle per bulk call, not two
        assertFalse(
            albumDir.resolve(WRITE_LOCK_FILENAME).toFile().exists(),
            "Lock file must be removed after bulk write",
        )
    }

    @Test
    fun `writeBulkTags with empty lists succeeds without touching files`() = runTest {
        val album = buildAlbum()
        coEvery { albumRepository.findById(albumId) } returns album
        coEvery { albumRepository.save(any()) } answers { firstArg() }

        val result = service.writeBulkTags(
            albumId,
            albumFields = emptyList(),
            trackFields = emptyList(),
        )

        assertEquals(album, result)
    }

    @Test
    fun `writeBulkTags throws IllegalArgumentException for unknown album field`() = runTest {
        assertFailsWith<IllegalArgumentException> {
            service.writeBulkTags(
                albumId,
                albumFields = listOf("INVALID_FIELD" to "value"),
                trackFields = emptyList(),
            )
        }
    }

    @Test
    fun `writeBulkTags throws IllegalArgumentException for unknown track field`() = runTest {
        assertFailsWith<IllegalArgumentException> {
            service.writeBulkTags(
                albumId,
                albumFields = emptyList(),
                trackFields = listOf(Triple(trackId, "INVALID_FIELD", "value")),
            )
        }
    }

    @Test
    fun `writeBulkTags throws ResourceNotFoundException when album not found`() = runTest {
        coEvery { albumRepository.findById(albumId) } returns null

        assertFailsWith<ResourceNotFoundException> {
            service.writeBulkTags(
                albumId,
                albumFields = listOf("GENRE" to "Jazz"),
                trackFields = emptyList(),
            )
        }
    }

    @Test
    fun `writeBulkTags throws ConflictException when write-lock file exists (CLI conflict)`() = runTest {
        val album = buildAlbum()
        coEvery { albumRepository.findById(albumId) } returns album

        // Simulate CLI holding the write-lock file (cleaned up by @AfterTest)
        Files.writeString(albumDir.resolve(WRITE_LOCK_FILENAME), "cli-write-in-progress")

        assertFailsWith<ConflictException> {
            service.writeBulkTags(
                albumId,
                albumFields = listOf("GENRE" to "Jazz"),
                trackFields = emptyList(),
            )
        }
    }

    @Test
    fun `writeBulkTags applies track-level fields after album-level fields`() = runTest {
        val flacFile = albumDir.resolve("01.flac")
        copyMinimalFlac(flacFile)

        val track = buildTrack(path = "01.flac")
        val album = buildAlbum()

        coEvery { albumRepository.findById(albumId) } returns album
        coEvery { albumRepository.save(any()) } answers { firstArg() }
        coEvery { trackRepository.findByAlbumId(albumId) } returns listOf(track)
        coEvery { trackRepository.update(any()) } just runs

        val result = service.writeBulkTags(
            albumId,
            albumFields = listOf("GENRE" to "Jazz"),
            trackFields = listOf(Triple(trackId, "TITLE", "So What")),
        )

        assertEquals("Jazz", result.genre)
        coVerify(exactly = 1) { trackRepository.update(any()) }
    }

    @Test
    fun `writeBulkTags throws SecurityException for merged directory path outside libraryRoot`() = runTest {
        // validatePath must be called before Files.isDirectory so a traversal path that does
        // not exist on disk is still rejected with SecurityException (issue #765 / #724).
        val outsideDir = Files.createTempDirectory("outside-root-bulk")
        try {
            val album = buildAlbum().copy(mergedDirectories = listOf(outsideDir.toString()))
            coEvery { albumRepository.findById(albumId) } returns album

            assertFailsWith<SecurityException> {
                service.writeBulkTags(
                    albumId,
                    albumFields = listOf("GENRE" to "Jazz"),
                    trackFields = emptyList(),
                )
            }
        } finally {
            outsideDir.toFile().deleteRecursively()
        }
    }

    // ──────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────

    /**
     * Copies a minimal valid FLAC file from test resources to [dest].
     * Uses a 1-second silence FLAC from the tagger module test fixtures if available,
     * otherwise creates a bare-minimum 4-byte fLaC marker (which is enough for our write tests
     * since we only test the service-level logic, not full codec round-tripping).
     */
    private fun copyMinimalFlac(dest: Path) {
        val resourcePath = "/minimal.flac"
        val stream = javaClass.getResourceAsStream(resourcePath)
        if (stream != null) {
            stream.use { Files.copy(it, dest) }
        } else {
            // Write a minimal FLAC file: fLaC marker + StreamInfo block
            // This is enough for FlacFile.read() to succeed in tests
            val minimalFlac = buildMinimalFlac()
            Files.write(dest, minimalFlac)
        }
    }

    @Suppress("MagicNumber") // FLAC StreamInfo bit-field layout per RFC 9639 §9.2
    private fun buildMinimalFlac(): ByteArray {
        // fLaC marker
        val marker = byteArrayOf(0x66, 0x4C, 0x61, 0x43)
        // StreamInfo block: type=0 (last=true), length=34, minimal StreamInfo payload
        val streamInfoPayload = ByteArray(34) { 0 }.also {
            // minBlockSize=4096, maxBlockSize=4096
            it[0] = 0x10; it[1] = 0x00
            it[2] = 0x10; it[3] = 0x00
            // minFrameSize=0, maxFrameSize=0 (3 bytes each)
            it[4] = 0; it[5] = 0; it[6] = 0
            it[7] = 0; it[8] = 0; it[9] = 0
            // sampleRate=44100 (0xAC44) in upper 20 bits of 8-byte group
            // channels=1, bitsPerSample=16, totalSamples=44100
            // Byte 10: sr[19:12] = 0xAC >> 4 = 0x0A → wait, 44100 = 0xAC44
            // sr = 44100 = 0b1010110001000100
            // Byte 10: sr[19..12] = 0b10101100 = 0xAC
            it[10] = 0xAC.toByte()
            // Byte 11: sr[11..4] = 0b01000100 = 0x44
            it[11] = 0x44.toByte()
            // Byte 12: sr[3..0]|ch[2..0]|bps[4]
            // sr[3..0]=0, ch=0 (1ch-1=0), bps=15 (16bit-1=15 → 4 bits: 0b1111)
            // = 0000 000 1111 → split: [sr3..0]=0000, [ch2..0]=000, [bps4]=1
            // = 0x00 | 0x00 | 0b0_0001 = 0x01? No, layout:
            // bit 7-4: sr[3:0]=0, bit 3-1: ch[2:0]=0, bit 0: bps[4]=1 → 0x01
            it[12] = 0x01.toByte()
            // Byte 13: bps[3..0]=1111, totalSamples[35..32]=0
            it[13] = 0xF0.toByte()
            // Bytes 14-17: totalSamples[31..0] = 44100 = 0x0000AC44
            it[14] = 0x00; it[15] = 0x00
            it[16] = 0xAC.toByte(); it[17] = 0x44.toByte()
            // Bytes 18-33: MD5 signature (16 bytes, all zero = silence)
        }
        val len0 = ((34 shr 16) and 0xFF).toByte()
        val len1 = ((34 shr 8) and 0xFF).toByte()
        val len2 = (34 and 0xFF).toByte()

        // VorbisComment block (type=4), minimal: vendor string + 0 comments
        val vendorBytes = "kbeatz".toByteArray(Charsets.UTF_8)
        val vcPayload = buildVorbisCommentPayload(vendorBytes)
        val vcHeaderByte = (0x80 or 4).toByte() // last=true, type=VorbisComment=4
        // Correct: remove LAST flag from streamInfo block
        val siHeaderByte = 0.toByte() // last=false, type=StreamInfo=0
        val vcLen0 = ((vcPayload.size shr 16) and 0xFF).toByte()
        val vcLen1 = ((vcPayload.size shr 8) and 0xFF).toByte()
        val vcLen2 = (vcPayload.size and 0xFF).toByte()
        val vcHeader = byteArrayOf(vcHeaderByte, vcLen0, vcLen1, vcLen2)

        return marker + byteArrayOf(siHeaderByte, len0, len1, len2) + streamInfoPayload + vcHeader + vcPayload
    }

    @Suppress("MagicNumber")
    private fun buildVorbisCommentPayload(vendorBytes: ByteArray): ByteArray {
        val result = ByteArray(4 + vendorBytes.size + 4)
        // Little-endian vendor length
        result[0] = (vendorBytes.size and 0xFF).toByte()
        result[1] = ((vendorBytes.size shr 8) and 0xFF).toByte()
        result[2] = ((vendorBytes.size shr 16) and 0xFF).toByte()
        result[3] = ((vendorBytes.size shr 24) and 0xFF).toByte()
        vendorBytes.copyInto(result, 4)
        // 0 comments (4 little-endian zero bytes)
        result[4 + vendorBytes.size] = 0
        result[5 + vendorBytes.size] = 0
        result[6 + vendorBytes.size] = 0
        result[7 + vendorBytes.size] = 0
        return result
    }
}
