package org.javafreedom.kbeatz.sources.discogs

import io.ktor.client.*
import io.ktor.client.engine.mock.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import java.nio.file.Files
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

/**
 * Tests for [DiscogsMetadataSource.downloadImages].
 *
 * All HTTP is mocked via Ktor's [MockEngine]. The album directory and metadata.json are
 * created in a temp directory so no real filesystem state is required.
 */
class DiscogsDownloadImagesTest {

    private val jpegBytes = byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte(), 0xE0.toByte())

    private val metadataJsonFrontOnly = """
        {
          "schemaVersion": 1,
          "source": "discogs",
          "sourceId": "12345",
          "fetchedAt": "2026-06-09T10:00:00Z",
          "album": {
            "title": "Kind of Blue",
            "albumArtist": "Miles Davis",
            "date": "1959",
            "genres": ["Jazz"],
            "styles": [],
            "label": "Columbia",
            "catalogNumber": "CL 1355",
            "barcode": null,
            "composer": null,
            "conductor": null,
            "ensemble": null,
            "discTotal": 1
          },
          "tracks": [],
          "images": [
            {
              "pictureType": 3,
              "description": "Cover",
              "mimeType": "image/jpeg",
              "sourceUri": "https://img.discogs.com/cover.jpg",
              "localPath": "folder.jpg"
            }
          ]
        }
    """.trimIndent()

    private val metadataJsonFrontAndBack = """
        {
          "schemaVersion": 1,
          "source": "discogs",
          "sourceId": "12345",
          "fetchedAt": "2026-06-09T10:00:00Z",
          "album": {
            "title": "Kind of Blue",
            "albumArtist": "Miles Davis",
            "date": "1959",
            "genres": [],
            "styles": [],
            "label": null,
            "catalogNumber": null,
            "barcode": null,
            "composer": null,
            "conductor": null,
            "ensemble": null,
            "discTotal": 1
          },
          "tracks": [],
          "images": [
            {
              "pictureType": 3,
              "description": "Front",
              "mimeType": "image/jpeg",
              "sourceUri": "https://img.discogs.com/cover.jpg",
              "localPath": "folder.jpg"
            },
            {
              "pictureType": 4,
              "description": "Back",
              "mimeType": "image/jpeg",
              "sourceUri": "https://img.discogs.com/back.jpg",
              "localPath": "back.jpg"
            }
          ]
        }
    """.trimIndent()

    private fun buildSource(
        imageBytes: ByteArray = jpegBytes,
        quota: DiscogsImageQuota = DiscogsImageQuota(),
    ): DiscogsMetadataSource {
        val mockEngine = MockEngine { request ->
            respond(
                content = imageBytes,
                status = HttpStatusCode.OK,
                headers = headersOf(HttpHeaders.ContentType, "image/jpeg"),
            )
        }
        return DiscogsMetadataSource.withHttpClient(
            token = "test-token",
            httpClient = HttpClient(mockEngine) {
                install(ContentNegotiation) {
                    json(Json { ignoreUnknownKeys = true })
                }
            },
            imageQuota = quota,
        )
    }

    private fun prepareAlbumDir(metadataContent: String): java.nio.file.Path {
        val albumDir = Files.createTempDirectory("kbeatz-test-album")
        val kbeatzDir = albumDir.resolve(".kbeatz")
        Files.createDirectories(kbeatzDir)
        Files.writeString(kbeatzDir.resolve("metadata.json"), metadataContent)
        return albumDir
    }

    // --- happy path ---

    @Test
    fun `front cover downloaded to folder dot jpg`() = runBlocking {
        val albumDir = prepareAlbumDir(metadataJsonFrontOnly)
        val source = buildSource()

        val results = source.downloadImages(albumDir, setOf(3))

        assertEquals(1, results.size)
        val result = results.first()
        assertIs<ImageDownloadResult.Downloaded>(result)
        assertEquals(3, result.pictureType)
        assertTrue(Files.exists(albumDir.resolve("folder.jpg")), "folder.jpg must exist")
    }

    @Test
    fun `multiple types downloaded when both present in metadata`() = runBlocking {
        val albumDir = prepareAlbumDir(metadataJsonFrontAndBack)
        val source = buildSource()

        val results = source.downloadImages(albumDir, setOf(3, 4))

        assertEquals(2, results.size)
        val downloaded = results.filterIsInstance<ImageDownloadResult.Downloaded>()
        assertEquals(2, downloaded.size)
        assertTrue(Files.exists(albumDir.resolve("folder.jpg")), "folder.jpg must exist")
        assertTrue(Files.exists(albumDir.resolve("back.jpg")), "back.jpg must exist")
    }

    @Test
    fun `written bytes match downloaded content`() = runBlocking {
        val albumDir = prepareAlbumDir(metadataJsonFrontOnly)
        val source = buildSource(imageBytes = jpegBytes)

        source.downloadImages(albumDir, setOf(3))

        val written = Files.readAllBytes(albumDir.resolve("folder.jpg"))
        assertTrue(written.contentEquals(jpegBytes), "Written bytes must match downloaded bytes")
    }

    // --- quota exhausted ---

    @Test
    fun `quota exhausted returns QuotaExceeded and no file written`() = runBlocking {
        val albumDir = prepareAlbumDir(metadataJsonFrontOnly)
        val exhaustedQuota = DiscogsImageQuota().also { q -> repeat(1000) { q.recordDownload() } }
        val source = buildSource(quota = exhaustedQuota)

        val results = source.downloadImages(albumDir, setOf(3))

        assertEquals(1, results.size)
        assertIs<ImageDownloadResult.QuotaExceeded>(results.first())
        assertEquals(3, (results.first() as ImageDownloadResult.QuotaExceeded).pictureType)
        assertTrue(!Files.exists(albumDir.resolve("folder.jpg")), "No file must be written when quota exhausted")
    }

    @Test
    fun `quota exhausted returns QuotaExceeded for all requested types`() = runBlocking {
        val albumDir = prepareAlbumDir(metadataJsonFrontAndBack)
        val exhaustedQuota = DiscogsImageQuota().also { q -> repeat(1000) { q.recordDownload() } }
        val source = buildSource(quota = exhaustedQuota)

        val results = source.downloadImages(albumDir, setOf(3, 4))

        assertEquals(2, results.size)
        assertTrue(results.all { it is ImageDownloadResult.QuotaExceeded })
    }

    // --- skip existing ---

    @Test
    fun `existing file not overwritten when overwriteExisting is false`() = runBlocking {
        val albumDir = prepareAlbumDir(metadataJsonFrontOnly)
        val originalContent = byteArrayOf(0x01, 0x02)
        Files.write(albumDir.resolve("folder.jpg"), originalContent)
        val source = buildSource(imageBytes = jpegBytes)

        val results = source.downloadImages(albumDir, setOf(3), overwriteExisting = false)

        assertEquals(1, results.size)
        val result = results.first()
        assertIs<ImageDownloadResult.Skipped>(result)
        assertEquals(3, result.pictureType)
        // Original file must be untouched
        val afterContent = Files.readAllBytes(albumDir.resolve("folder.jpg"))
        assertTrue(afterContent.contentEquals(originalContent), "Original file must be preserved")
    }

    @Test
    fun `existing file overwritten when overwriteExisting is true`() = runBlocking {
        val albumDir = prepareAlbumDir(metadataJsonFrontOnly)
        Files.write(albumDir.resolve("folder.jpg"), byteArrayOf(0x01))
        val source = buildSource(imageBytes = jpegBytes)

        val results = source.downloadImages(albumDir, setOf(3), overwriteExisting = true)

        assertEquals(1, results.size)
        assertIs<ImageDownloadResult.Downloaded>(results.first())
        val afterContent = Files.readAllBytes(albumDir.resolve("folder.jpg"))
        assertTrue(afterContent.contentEquals(jpegBytes), "File must be overwritten with new content")
    }

    // --- missing pictureType in metadata ---

    @Test
    fun `skipped when requested type not in metadata`() = runBlocking {
        val albumDir = prepareAlbumDir(metadataJsonFrontOnly)
        val source = buildSource()

        val results = source.downloadImages(albumDir, setOf(4))

        assertEquals(1, results.size)
        val result = results.first()
        assertIs<ImageDownloadResult.Skipped>(result)
        assertEquals(4, result.pictureType)
    }

    // --- missing metadata.json ---

    @Test
    fun `all skipped when metadata dot json does not exist`() = runBlocking {
        val albumDir = Files.createTempDirectory("kbeatz-no-meta")
        val source = buildSource()

        val results = source.downloadImages(albumDir, setOf(3, 4))

        assertEquals(2, results.size)
        assertTrue(results.all { it is ImageDownloadResult.Skipped })
    }

    // --- empty requestedTypes ---

    @Test
    fun `empty result when requestedTypes is empty`() = runBlocking {
        val albumDir = prepareAlbumDir(metadataJsonFrontOnly)
        val source = buildSource()

        val results = source.downloadImages(albumDir, emptySet())

        assertTrue(results.isEmpty())
    }
}
