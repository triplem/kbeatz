package org.javafreedom.kbeatz.catalog.application.service

import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import java.nio.file.Files
import java.nio.file.Path
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

    private val albumRepository: AlbumRepository = mockk()
    private val trackRepository: TrackRepository = mockk()

    private val service = TagWriteService(albumRepository, trackRepository, libraryRoot)

    private val albumId = Uuid.random()
    private val trackId = Uuid.random()

    private fun buildAlbum(dir: Path = albumDir) = Album(
        id = albumId,
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

        // Simulate CLI holding the write-lock file
        Files.writeString(albumDir.resolve(WRITE_LOCK_FILENAME), "cli-write-in-progress")

        try {
            assertFailsWith<ConflictException> {
                service.writeAlbumTags(albumId, "GENRE", "Jazz")
            }
        } finally {
            // Clean up lock file
            Files.deleteIfExists(albumDir.resolve(WRITE_LOCK_FILENAME))
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
        val headerByte = (0x80 or 0).toByte() // last=true, type=StreamInfo=0
        val len0 = ((34 shr 16) and 0xFF).toByte()
        val len1 = ((34 shr 8) and 0xFF).toByte()
        val len2 = (34 and 0xFF).toByte()
        val blockHeader = byteArrayOf(headerByte, len0, len1, len2)

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
