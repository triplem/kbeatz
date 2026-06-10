package org.javafreedom.kbeatz.catalog.infrastructure.sync

import io.mockk.coEvery
import io.mockk.mockk
import java.nio.file.Files
import kotlin.test.Test
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import kotlin.time.Clock
import kotlin.time.ExperimentalTime
import kotlin.time.Instant
import kotlinx.coroutines.runBlocking
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlinx.datetime.atStartOfDayIn
import kotlinx.io.bytestring.ByteString
import org.javafreedom.kbeatz.common.ImageQuotaExhaustedException
import org.javafreedom.kbeatz.sources.ImageResult
import org.javafreedom.kbeatz.sources.MetadataSource
import org.javafreedom.kbeatz.sources.discogs.DiscogsImageQuota

/**
 * Unit tests for [DiscogsImageService].
 */
class DiscogsImageServiceTest {

    private val sampleJpegBytes = byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte())
    private val sampleImageResult = ImageResult(
        bytes = ByteString(sampleJpegBytes),
        mimeType = "image/jpeg",
    )

    private fun buildService(
        fetchResult: ImageResult? = sampleImageResult,
        quotaExhausted: Boolean = false,
        embedInFiles: Boolean = true,
    ): DiscogsImageService {
        val source = mockk<MetadataSource>()
        coEvery { source.fetchImage(any(), any()) } returns fetchResult

        val quota = DiscogsImageQuota()
        if (quotaExhausted) repeat(1000) { quota.recordDownload() }

        return DiscogsImageService(
            metadataSource = source,
            imageQuota = quota,
            embedInFiles = embedInFiles,
        )
    }

    // ---- downloadImages=false ----

    @Test
    fun `should return false without downloading when downloadImages=false`() = runBlocking {
        val dir = Files.createTempDirectory("cover-art-test")
        val service = buildService()

        val result = service.downloadAndWrite("12345", dir, downloadImages = false)

        assertFalse(result)
        assertFalse(Files.list(dir).use { it.findAny().isPresent }, "No files should be written")
    }

    // ---- quota exhausted ----

    @Test
    fun `should throw ImageQuotaExhaustedException when quota is exhausted`() = runBlocking {
        val dir = Files.createTempDirectory("cover-art-test")
        val service = buildService(quotaExhausted = true)

        assertFailsWith<ImageQuotaExhaustedException> {
            service.downloadAndWrite("12345", dir, downloadImages = true)
        }

        assertFalse(Files.list(dir).use { it.findAny().isPresent }, "No files should be written on quota error")
    }

    @Test
    @OptIn(ExperimentalTime::class)
    fun `ImageQuotaExhaustedException should contain UTC midnight reset time`() = runBlocking {
        val dir = Files.createTempDirectory("cover-art-test")
        val fixedInstant: Instant = LocalDate(2026, 6, 7).atStartOfDayIn(TimeZone.UTC).toEpochMilliseconds()
            .let { Instant.fromEpochMilliseconds(it) }
        val fixedClock = object : Clock {
            override fun now(): Instant = fixedInstant
        }
        val quota = DiscogsImageQuota()
        repeat(1000) { quota.recordDownload() }
        val service = DiscogsImageService(
            metadataSource = mockk<MetadataSource>().also {
                coEvery { it.fetchImage(any(), any()) } returns sampleImageResult
            },
            imageQuota = quota,
            clock = fixedClock,
        )

        val ex = assertFailsWith<ImageQuotaExhaustedException> {
            service.downloadAndWrite("12345", dir, downloadImages = true)
        }

        assertTrue(ex.resetAt.startsWith("2026-06-08"), "Reset time should be midnight of the next day")
    }

    // ---- folder.jpg write ----

    @Test
    fun `should write folder_jpg when downloadImages=true and quota available`() = runBlocking {
        val dir = Files.createTempDirectory("cover-art-test")
        val service = buildService()

        val result = service.downloadAndWrite("12345", dir, downloadImages = true)

        assertTrue(result)
        assertTrue(Files.exists(dir.resolve("folder.jpg")), "folder.jpg should be written")
    }

    @Test
    fun `should write folder_png when image mime type is image_png`() = runBlocking {
        val dir = Files.createTempDirectory("cover-art-test")
        val pngResult = ImageResult(
            bytes = ByteString(byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47)),
            mimeType = "image/png",
        )
        val service = buildService(fetchResult = pngResult)

        service.downloadAndWrite("12345", dir, downloadImages = true)

        assertTrue(Files.exists(dir.resolve("folder.png")), "folder.png should be written for PNG images")
    }

    @Test
    fun `folder_jpg content should match downloaded image bytes`() = runBlocking {
        val dir = Files.createTempDirectory("cover-art-test")
        val service = buildService()

        service.downloadAndWrite("12345", dir, downloadImages = true)

        val written = Files.readAllBytes(dir.resolve("folder.jpg"))
        assertTrue(written.contentEquals(sampleJpegBytes), "Written bytes should match downloaded image")
    }

    // ---- no image available ----

    @Test
    fun `should return false when metadataSource returns no image`() = runBlocking {
        val dir = Files.createTempDirectory("cover-art-test")
        val service = buildService(fetchResult = null)

        val result = service.downloadAndWrite("12345", dir, downloadImages = true)

        assertFalse(result)
        assertFalse(Files.exists(dir.resolve("folder.jpg")), "No folder.jpg should be written when no image available")
    }

    // ---- embedInFiles strategy ----

    @Test
    fun `should not modify FLAC files when embedInFiles=false`() = runBlocking {
        val dir = Files.createTempDirectory("cover-art-test")
        val service = buildService(embedInFiles = false)

        // Create a fake FLAC file (not valid FLAC — just checking it's not touched)
        val fakeFlac = dir.resolve("track.flac")
        Files.write(fakeFlac, byteArrayOf(0x01, 0x02, 0x03))
        val originalBytes = Files.readAllBytes(fakeFlac)

        service.downloadAndWrite("12345", dir, downloadImages = true)

        val afterBytes = Files.readAllBytes(fakeFlac)
        assertTrue(afterBytes.contentEquals(originalBytes), "FLAC file should not be modified when embedInFiles=false")
        assertTrue(Files.exists(dir.resolve("folder.jpg")), "folder.jpg should still be written")
    }

    // ---- embedInFiles config accessor ----

    @Test
    fun `embedInFiles property returns configured value`() {
        assertTrue(buildService(embedInFiles = true).embedInFiles)
        assertFalse(buildService(embedInFiles = false).embedInFiles)
    }
}
