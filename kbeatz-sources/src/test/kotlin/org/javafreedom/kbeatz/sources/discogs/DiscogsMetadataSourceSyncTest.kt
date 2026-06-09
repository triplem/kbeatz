package org.javafreedom.kbeatz.sources.discogs

import io.ktor.client.*
import io.ktor.client.engine.mock.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import org.javafreedom.kbeatz.common.metadata.KbeatzMetadata
import java.nio.file.Files
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

/**
 * Integration tests for [DiscogsMetadataSource.syncAlbum].
 *
 * All HTTP is mocked via Ktor's [MockEngine]. Album directories are created in temp directories.
 */
class DiscogsMetadataSourceSyncTest {

    private val sampleReleaseJson = """
        {
          "id": "12345",
          "title": "Kind of Blue",
          "artists": [{"id": "1", "name": "Miles Davis", "role": "", "join": null}],
          "extraartists": [],
          "year": 1959,
          "released": "1959-08-17",
          "labels": [{"name": "Columbia", "catno": "CL 1355"}],
          "genres": ["Jazz"],
          "styles": ["Modal"],
          "country": "US",
          "notes": null,
          "tracklist": [
            {"position": "1", "title": "So What", "duration": "9:22", "artists": [], "extraartists": []},
            {"position": "2", "title": "Freddie Freeloader", "duration": "9:46", "artists": [], "extraartists": []}
          ],
          "images": [
            {"type": "primary", "uri": "https://img.discogs.com/cover.jpg", "width": 600, "height": 600}
          ],
          "master_url": null,
          "resource_url": "https://api.discogs.com/releases/12345"
        }
    """.trimIndent()

    private val multiDiscReleaseJson = """
        {
          "id": "67890",
          "title": "The Wall",
          "artists": [{"id": "2", "name": "Pink Floyd", "role": "", "join": null}],
          "extraartists": [],
          "year": 1979,
          "released": null,
          "labels": [],
          "genres": ["Rock"],
          "styles": [],
          "country": null,
          "notes": null,
          "tracklist": [
            {"position": "1-01", "title": "In the Flesh?", "duration": "3:19", "artists": [], "extraartists": []},
            {"position": "1-02", "title": "The Thin Ice", "duration": "2:27", "artists": [], "extraartists": []},
            {"position": "2-01", "title": "Hey You", "duration": "4:40", "artists": [], "extraartists": []},
            {"position": "2-02", "title": "Is There Anybody Out There?", "duration": "2:44", "artists": [], "extraartists": []}
          ],
          "images": [],
          "master_url": null,
          "resource_url": "https://api.discogs.com/releases/67890"
        }
    """.trimIndent()

    private fun buildSource(
        releaseJson: String = sampleReleaseJson,
        statusCode: HttpStatusCode = HttpStatusCode.OK,
    ): DiscogsMetadataSource {
        val mockEngine = MockEngine { request ->
            respond(
                content = releaseJson,
                status = statusCode,
                headers = headersOf(HttpHeaders.ContentType, ContentType.Application.Json.toString()),
            )
        }
        return DiscogsMetadataSource.withHttpClient(
            token = "test-token",
            httpClient = HttpClient(mockEngine) {
                install(ContentNegotiation) {
                    json(Json { ignoreUnknownKeys = true })
                }
            },
        )
    }

    // --- happy path ---

    @Test
    fun `syncAlbum writes raw JSON file`() = runBlocking {
        val albumDir = Files.createTempDirectory("kbeatz-sync-test")
        val source = buildSource()

        val result = source.syncAlbum("12345", albumDir)

        assertIs<SyncResult.Success>(result)
        val rawFile = albumDir.resolve(".kbeatz/source_discogs_12345.json")
        assertTrue(Files.exists(rawFile), "Raw JSON file must exist")
        val content = Files.readString(rawFile)
        assertTrue(content.contains("Kind of Blue"), "Raw JSON must contain release title")
    }

    @Test
    fun `syncAlbum writes metadata dot json`() = runBlocking {
        val albumDir = Files.createTempDirectory("kbeatz-sync-test")
        val source = buildSource()

        val result = source.syncAlbum("12345", albumDir)

        assertIs<SyncResult.Success>(result)
        val metadataFile = albumDir.resolve(".kbeatz/metadata.json")
        assertTrue(Files.exists(metadataFile), "metadata.json must exist")
    }

    @Test
    fun `syncAlbum metadata dot json is valid KbeatzMetadata`() = runBlocking {
        val albumDir = Files.createTempDirectory("kbeatz-sync-test")
        val source = buildSource()

        source.syncAlbum("12345", albumDir)

        val json = Files.readString(albumDir.resolve(".kbeatz/metadata.json"))
        val metadata = Json { ignoreUnknownKeys = true }.decodeFromString(KbeatzMetadata.serializer(), json)
        assertEquals("discogs", metadata.source)
        assertEquals("12345", metadata.sourceId)
        assertEquals("Kind of Blue", metadata.album.title)
        assertEquals("Miles Davis", metadata.album.albumArtist)
        assertEquals(2, metadata.tracks.size)
        assertEquals("So What", metadata.tracks[0].title)
    }

    @Test
    fun `syncAlbum success result contains path to metadata dot json`() = runBlocking {
        val albumDir = Files.createTempDirectory("kbeatz-sync-test")
        val source = buildSource()

        val result = source.syncAlbum("12345", albumDir)

        assertIs<SyncResult.Success>(result)
        assertTrue(result.metadataPath.endsWith(".kbeatz/metadata.json"))
    }

    @Test
    fun `syncAlbum creates kbeatz directory if absent`() = runBlocking {
        val albumDir = Files.createTempDirectory("kbeatz-sync-test")
        val source = buildSource()

        source.syncAlbum("12345", albumDir)

        assertTrue(Files.isDirectory(albumDir.resolve(".kbeatz")))
    }

    // --- re-sync overwrites ---

    @Test
    fun `re-sync overwrites existing raw JSON and metadata`() = runBlocking {
        val albumDir = Files.createTempDirectory("kbeatz-sync-test")
        val firstSource = buildSource(releaseJson = sampleReleaseJson)
        firstSource.syncAlbum("12345", albumDir)

        val updatedReleaseJson = sampleReleaseJson.replace("Kind of Blue", "Kind of Blue (Remaster)")
        val secondSource = buildSource(releaseJson = updatedReleaseJson)
        secondSource.syncAlbum("12345", albumDir)

        val rawContent = Files.readString(albumDir.resolve(".kbeatz/source_discogs_12345.json"))
        assertTrue(rawContent.contains("Kind of Blue (Remaster)"), "Raw JSON must be updated on re-sync")
        val metadataContent = Files.readString(albumDir.resolve(".kbeatz/metadata.json"))
        assertTrue(metadataContent.contains("Kind of Blue (Remaster)"), "metadata.json must be updated on re-sync")
    }

    // --- multi-disc position parsing ---

    @Test
    fun `multi-disc positions parsed correctly in metadata dot json`() = runBlocking {
        val albumDir = Files.createTempDirectory("kbeatz-sync-test-multidisc")
        val source = buildSource(releaseJson = multiDiscReleaseJson)

        source.syncAlbum("67890", albumDir)

        val json = Files.readString(albumDir.resolve(".kbeatz/metadata.json"))
        val metadata = Json { ignoreUnknownKeys = true }.decodeFromString(KbeatzMetadata.serializer(), json)

        assertEquals(4, metadata.tracks.size)
        assertEquals(1, metadata.tracks[0].discNumber)
        assertEquals(1, metadata.tracks[0].trackNumber)
        assertEquals(1, metadata.tracks[1].discNumber)
        assertEquals(2, metadata.tracks[1].trackNumber)
        assertEquals(2, metadata.tracks[2].discNumber)
        assertEquals(1, metadata.tracks[2].trackNumber)
        assertEquals(2, metadata.tracks[3].discNumber)
        assertEquals(2, metadata.tracks[3].trackNumber)
        assertEquals(2, metadata.album.discTotal)
    }

    // --- rate limit response ---

    @Test
    fun `syncAlbum returns RateLimitExceeded on HTTP 429`() = runBlocking {
        val albumDir = Files.createTempDirectory("kbeatz-sync-rate-limit")
        val source = buildSource(statusCode = HttpStatusCode.TooManyRequests)

        val result = source.syncAlbum("12345", albumDir)

        assertIs<SyncResult.RateLimitExceeded>(result)
        assertTrue(result.retryAfterMs > 0)
    }

    // --- input validation ---

    @Test
    fun `syncAlbum rejects discogsId with path traversal characters`() = runBlocking {
        val albumDir = Files.createTempDirectory("kbeatz-sync-invalid")
        val source = buildSource()

        var exceptionThrown = false
        try {
            source.syncAlbum("../../etc/cron.d/evil", albumDir)
        } catch (ex: IllegalArgumentException) {
            exceptionThrown = true
        }

        assertTrue(exceptionThrown, "syncAlbum must reject discogsId containing path traversal chars")
    }

    @Test
    fun `syncAlbum accepts numeric discogsId`() = runBlocking {
        val albumDir = Files.createTempDirectory("kbeatz-sync-numeric")
        val source = buildSource()

        val result = source.syncAlbum("12345", albumDir)

        assertIs<SyncResult.Success>(result)
    }
}
