package org.javafreedom.kbeatz.sources.discogs

import io.ktor.client.*
import io.ktor.client.engine.mock.*
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.SerializationException
import org.javafreedom.kbeatz.sources.cache.InMemoryMetadataCache
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.time.measureTime

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
        cache: InMemoryMetadataCache? = null,
        requestCounter: MutableList<String>? = null,
    ): DiscogsMetadataSource {
        val mockEngine = MockEngine { request ->
            val url = request.url.toString()
            requestCounter?.add(url)
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
            cache = cache,
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

    @Test
    fun `fetchRelease should store result in cache after API call`() = runBlocking {
        val cache = InMemoryMetadataCache()
        val source = buildSource(cache = cache)

        source.fetchRelease("12345")

        val cached = cache.get("discogs", "12345")
        assertNotNull(cached)
        assertEquals("Kind of Blue", cached.title)
    }

    @Test
    fun `fetchRelease should hit cache on second call and make no second HTTP request`() = runBlocking {
        val cache = InMemoryMetadataCache()
        val requests = mutableListOf<String>()
        val source = buildSource(cache = cache, requestCounter = requests)

        source.fetchRelease("12345")
        source.fetchRelease("12345")

        // Only one HTTP request should have been made - the second call returns the cached value
        assertEquals(1, requests.size)
    }

    // --- NFR-04: Discogs fetch latency ---

    /**
     * NFR-04 acceptance test: a Discogs release fetch (mock, no network or token-wait)
     * must complete within 5 000 ms.
     *
     * This guards against inadvertent blocking calls, deadlocks, or unbounded waits
     * being introduced in the fetch path. The mock engine responds instantly, so
     * the measured time reflects only local processing overhead.
     *
     * Threshold: 5 000 ms (NFR-04, exclusive of real network and token-bucket wait time).
     */
    @Test
    fun `NFR-04 fetchRelease completes within 5000 ms against a no-delay mock`() = runBlocking {
        val source = buildSource()

        val elapsed = measureTime {
            val release = source.fetchRelease("12345")
            assertNotNull(release)
        }

        assertTrue(
            elapsed.inWholeMilliseconds < 5_000,
            "Expected fetchRelease to complete within 5000 ms but took ${elapsed.inWholeMilliseconds} ms"
        )
    }

    // --- Error handling: timeout, malformed JSON, missing fields ---

    /**
     * When the mock engine delays longer than the client timeout, Ktor throws a
     * [io.ktor.client.plugins.HttpRequestTimeoutException]. The library propagates this
     * exception to the caller rather than returning null, so callers can distinguish
     * "no data" from "timed out".
     */
    @Test
    fun `fetchRelease propagates timeout exception when server does not respond in time`() = runBlocking {
        val timeoutMs = 100L
        val mockEngine = MockEngine {
            delay(timeoutMs * 10) // delay far beyond timeout
            respond("", HttpStatusCode.OK)
        }
        val source = DiscogsMetadataSource.withHttpClient(
            token = "test-token",
            httpClient = HttpClient(mockEngine) {
                install(ContentNegotiation) {
                    json(Json { ignoreUnknownKeys = true })
                }
                install(HttpTimeout) {
                    requestTimeoutMillis = timeoutMs
                }
            },
        )

        assertFailsWith<io.ktor.client.plugins.HttpRequestTimeoutException> {
            source.fetchRelease("12345")
        }
    }

    // --- HTTP status code handling: 429, 404, 5xx ---

    /**
     * When Discogs returns HTTP 429 Too Many Requests, [fetchRelease] checks the status before
     * attempting to deserialize the body and throws [DiscogsRateLimitException] with the retry
     * delay derived from the Retry-After header.
     *
     * This prevents the previous bug where a 429 body was silently passed to ContentNegotiation,
     * causing an opaque serialization error or corrupted data.
     */
    @Test
    fun `fetchRelease throws DiscogsRateLimitException when Discogs returns 429`() =
        runBlocking {
            val mockEngine = MockEngine {
                respond(
                    content = """{"message":"You are being rate limited."}""",
                    status = HttpStatusCode.TooManyRequests,
                    headers = headersOf(
                        HttpHeaders.ContentType to listOf(ContentType.Application.Json.toString()),
                        HttpHeaders.RetryAfter to listOf("30"),
                    ),
                )
            }
            val source = DiscogsMetadataSource.withHttpClient(
                token = "test-token",
                httpClient = HttpClient(mockEngine) {
                    install(ContentNegotiation) {
                        json(Json { ignoreUnknownKeys = true })
                    }
                },
            )

            val ex = assertFailsWith<DiscogsRateLimitException> {
                source.fetchRelease("12345")
            }
            assertEquals(30_000L, ex.retryAfterMs)
            assertEquals("12345", ex.releaseId)
            assertEquals(429, ex.statusCode)
        }

    /**
     * When Discogs returns HTTP 429 with no Retry-After header, [fetchRelease] falls back
     * to the default retry delay of 60 seconds (60 000 ms).
     */
    @Test
    fun `fetchRelease uses default retry delay when Retry-After header is absent on 429`() =
        runBlocking {
            val mockEngine = MockEngine {
                respond(
                    content = """{"message":"You are being rate limited."}""",
                    status = HttpStatusCode.TooManyRequests,
                    headers = headersOf(HttpHeaders.ContentType, ContentType.Application.Json.toString()),
                )
            }
            val source = DiscogsMetadataSource.withHttpClient(
                token = "test-token",
                httpClient = HttpClient(mockEngine) {
                    install(ContentNegotiation) {
                        json(Json { ignoreUnknownKeys = true })
                    }
                },
            )

            val ex = assertFailsWith<DiscogsRateLimitException> {
                source.fetchRelease("12345")
            }
            // DEFAULT_RETRY_AFTER_SECONDS = 60, so retryAfterMs = 60 * 1000
            assertEquals(60_000L, ex.retryAfterMs)
        }

    /**
     * When Discogs returns HTTP 404, [fetchRelease] throws [DiscogsReleaseNotFoundException]
     * instead of attempting deserialization of an error body.
     */
    @Test
    fun `fetchRelease throws DiscogsReleaseNotFoundException when Discogs returns 404`() =
        runBlocking {
            val mockEngine = MockEngine {
                respond(
                    content = """{"message":"Release not found."}""",
                    status = HttpStatusCode.NotFound,
                    headers = headersOf(HttpHeaders.ContentType, ContentType.Application.Json.toString()),
                )
            }
            val source = DiscogsMetadataSource.withHttpClient(
                token = "test-token",
                httpClient = HttpClient(mockEngine) {
                    install(ContentNegotiation) {
                        json(Json { ignoreUnknownKeys = true })
                    }
                },
            )

            val ex = assertFailsWith<DiscogsReleaseNotFoundException> {
                source.fetchRelease("99999")
            }
            assertEquals("99999", ex.releaseId)
            assertEquals(404, ex.statusCode)
        }

    /**
     * When Discogs returns HTTP 500, [fetchRelease] throws [DiscogsServerException] with the
     * actual status code rather than a serialization error from the error body.
     */
    @Test
    fun `fetchRelease throws DiscogsServerException when Discogs returns 500`() =
        runBlocking {
            val mockEngine = MockEngine {
                respond(
                    content = """{"message":"Internal Server Error"}""",
                    status = HttpStatusCode.InternalServerError,
                    headers = headersOf(HttpHeaders.ContentType, ContentType.Application.Json.toString()),
                )
            }
            val source = DiscogsMetadataSource.withHttpClient(
                token = "test-token",
                httpClient = HttpClient(mockEngine) {
                    install(ContentNegotiation) {
                        json(Json { ignoreUnknownKeys = true })
                    }
                },
            )

            val ex = assertFailsWith<DiscogsServerException> {
                source.fetchRelease("12345")
            }
            assertEquals(500, ex.statusCode)
            assertEquals("12345", ex.releaseId)
        }

    /**
     * When Discogs returns HTTP 503 Service Unavailable, [fetchRelease] throws
     * [DiscogsServerException] - not a serialization error.
     */
    @Test
    fun `fetchRelease throws DiscogsServerException when Discogs returns 503`() =
        runBlocking {
            val mockEngine = MockEngine {
                respond(
                    content = """{"message":"Service Unavailable"}""",
                    status = HttpStatusCode.ServiceUnavailable,
                    headers = headersOf(HttpHeaders.ContentType, ContentType.Application.Json.toString()),
                )
            }
            val source = DiscogsMetadataSource.withHttpClient(
                token = "test-token",
                httpClient = HttpClient(mockEngine) {
                    install(ContentNegotiation) {
                        json(Json { ignoreUnknownKeys = true })
                    }
                },
            )

            val ex = assertFailsWith<DiscogsServerException> {
                source.fetchRelease("12345")
            }
            assertEquals(503, ex.statusCode)
        }

    /**
     * When the Discogs API returns a 200 with an invalid (non-JSON) body,
     * the serialization layer throws a [SerializationException]. This is the
     * expected behavior: the caller (catalog service or CLI) handles it as a
     * malformed-response error.
     */
    @Test
    fun `fetchRelease throws SerializationException when response body is not valid JSON`() = runBlocking {
        val mockEngine = MockEngine {
            respond(
                content = "this is not json at all",
                status = HttpStatusCode.OK,
                headers = headersOf(HttpHeaders.ContentType, ContentType.Application.Json.toString()),
            )
        }
        val source = DiscogsMetadataSource.withHttpClient(
            token = "test-token",
            httpClient = HttpClient(mockEngine) {
                install(ContentNegotiation) {
                    json(Json { ignoreUnknownKeys = true })
                }
            },
        )

        assertFailsWith<SerializationException> {
            source.fetchRelease("12345")
        }
    }

    /**
     * When the Discogs API returns a 200 response with a JSON object that is missing
     * required fields (e.g. "id" and "title"), deserialization throws a
     * [io.ktor.serialization.JsonConvertException] wrapping a
     * [kotlinx.serialization.MissingFieldException]. This is the expected behavior:
     * the caller (catalog service or CLI) handles it as a malformed-response error.
     */
    @Test
    fun `fetchRelease throws when required fields are missing from Discogs JSON response`() = runBlocking {
        val missingFieldsJson = """
            {
              "artists": [],
              "extraartists": [],
              "labels": [],
              "genres": [],
              "styles": [],
              "tracklist": [],
              "images": []
            }
        """.trimIndent()
        val source = buildSource(releaseResponse = missingFieldsJson)

        assertFailsWith<io.ktor.serialization.JsonConvertException> {
            source.fetchRelease("12345")
        }
    }

    /**
     * When the Discogs API returns 429 Too Many Requests, Ktor's [HttpRequestRetry] plugin
     * retries. With MockEngine we verify the client does NOT crash on a 429 and that the
     * retry eventually succeeds when a subsequent response is 200.
     *
     * Note: the token-bucket rate limiter is bypassed here (using a single-token bucket
     * with no wait) so this test focuses purely on the HTTP 429 path.
     */
    @Test
    fun `fetchRelease succeeds after a 429 response on first attempt`() = runBlocking {
        var callCount = 0
        val mockEngine = MockEngine {
            callCount++
            if (callCount == 1) {
                respond(
                    content = "",
                    status = HttpStatusCode.TooManyRequests,
                    headers = headersOf(
                        HttpHeaders.ContentType to listOf(ContentType.Application.Json.toString()),
                        HttpHeaders.RetryAfter to listOf("1"),
                    ),
                )
            } else {
                respond(
                    content = sampleReleaseJson,
                    status = HttpStatusCode.OK,
                    headers = headersOf(HttpHeaders.ContentType, ContentType.Application.Json.toString()),
                )
            }
        }
        val source = DiscogsMetadataSource.withHttpClient(
            token = "test-token",
            httpClient = HttpClient(mockEngine) {
                install(ContentNegotiation) {
                    json(Json { ignoreUnknownKeys = true })
                }
                install(io.ktor.client.plugins.HttpRequestRetry) {
                    retryOnServerErrors(maxRetries = 2)
                    retryIf { _, response -> response.status == HttpStatusCode.TooManyRequests }
                    constantDelay(millis = 10L) // fast retry in tests
                }
            },
        )

        val release = source.fetchRelease("12345")

        assertNotNull(release, "fetchRelease should succeed after 429 retry")
        assertEquals("Kind of Blue", release.title)
        assertEquals(2, callCount, "Expected exactly 2 HTTP calls: one 429 then one 200")
    }

    @Test
    fun `fetchImage should use cached release and not make a second API call for the release`() = runBlocking {
        val cache = InMemoryMetadataCache()
        val requests = mutableListOf<String>()
        val source = buildSource(cache = cache, requestCounter = requests)

        // Pre-populate cache with a release so fetchImage doesn't need to call the release endpoint
        source.fetchRelease("12345")
        val releaseRequests = requests.count { it.contains("/releases/") && !it.contains("img.discogs.com") }
        assertEquals(1, releaseRequests)

        requests.clear()

        // Now call fetchImage - it should only hit the image URL, not the release endpoint again
        val result = source.fetchImage("12345", 0)

        assertNotNull(result)
        val releaseRequestsAfter = requests.count { it.contains("/releases/") && !it.contains("img.discogs.com") }
        assertEquals(0, releaseRequestsAfter)
        val imageRequests = requests.count { it.contains("img.discogs.com") }
        assertEquals(1, imageRequests)
    }
}
