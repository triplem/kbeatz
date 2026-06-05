package org.javafreedom.kbeatz.sources.discogs

import io.ktor.client.*
import io.ktor.client.engine.mock.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import org.javafreedom.kbeatz.sources.ImageResult
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

/**
 * Unit tests for [DiscogsMetadataSource] using a Ktor mock engine.
 * We test the public contract (fetchRelease, fetchImage) without real HTTP.
 */
class DiscogsMetadataSourceTest {

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
          "tracklist": [],
          "images": [
            {"type": "primary", "uri": "https://img.discogs.com/cover.jpg", "width": 600, "height": 600}
          ],
          "master_url": "https://api.discogs.com/masters/1000",
          "resource_url": "https://api.discogs.com/releases/12345"
        }
    """.trimIndent()

    private fun buildSource(
        releaseResponse: String = sampleReleaseJson,
        imageBytes: ByteArray = byteArrayOf(0xFF.toByte(), 0xD8.toByte()),
        quota: DiscogsImageQuota = DiscogsImageQuota(),
    ): DiscogsMetadataSource {
        val mockEngine = MockEngine { request ->
            val url = request.url.toString()
            when {
                url.contains("/releases/") && !url.contains("img.discogs.com") ->
                    respond(
                        content = releaseResponse,
                        status = HttpStatusCode.OK,
                        headers = headersOf(HttpHeaders.ContentType, ContentType.Application.Json.toString()),
                    )
                else ->
                    respond(
                        content = imageBytes,
                        status = HttpStatusCode.OK,
                        headers = headersOf(HttpHeaders.ContentType, "image/jpeg"),
                    )
            }
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

    @Test
    fun `name should be discogs`() {
        val source = buildSource()
        assertEquals("discogs", source.name)
    }

    @Test
    fun `fetchRelease should return mapped domain Release`() = runBlocking {
        val source = buildSource()

        val release = source.fetchRelease("12345")

        assertNotNull(release)
        assertEquals("12345", release.sourceId)
        assertEquals("discogs", release.sourceName)
        assertEquals("Kind of Blue", release.title)
        assertEquals(1959, release.year)
    }

    @Test
    fun `fetchRelease should map artists correctly`() = runBlocking {
        val source = buildSource()

        val release = source.fetchRelease("12345")

        assertNotNull(release)
        assertEquals(1, release.artists.size)
        assertEquals("Miles Davis", release.artists[0].name)
    }

    @Test
    fun `fetchImage should return ImageResult when quota allows`() = runBlocking {
        val source = buildSource(imageBytes = byteArrayOf(0xFF.toByte(), 0xD8.toByte()))

        val result = source.fetchImage("12345", 0)

        assertNotNull(result)
        assertEquals("image/jpeg", result.mimeType)
    }

    @Test
    fun `fetchImage should return null when quota exhausted`() = runBlocking {
        val exhaustedQuota = DiscogsImageQuota()
        repeat(1000) { exhaustedQuota.recordDownload() }

        val source = buildSource(quota = exhaustedQuota)

        val result = source.fetchImage("12345", 0)

        assertNull(result)
    }

    @Test
    fun `fetchImage should return null when image index out of range`() = runBlocking {
        val source = buildSource()

        // Release only has 1 image at index 0; index 5 is out of range
        val result = source.fetchImage("12345", 5)

        assertNull(result)
    }

    @Test
    fun `fetchImage should detect PNG mime type from uri`() = runBlocking {
        val pngReleaseJson = sampleReleaseJson.replace(
            "https://img.discogs.com/cover.jpg",
            "https://img.discogs.com/cover.png",
        )
        val source = buildSource(releaseResponse = pngReleaseJson)

        val result = source.fetchImage("12345", 0)

        assertNotNull(result)
        assertEquals("image/png", result.mimeType)
    }
}
