package org.javafreedom.kbeatz.catalog.adapters.inbound.web.albums

import io.ktor.client.call.body
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation as ClientContentNegotiation
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.routing.routing
import io.ktor.server.testing.testApplication
import io.mockk.coEvery
import io.mockk.mockk
import java.nio.file.Path
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.time.Clock
import kotlin.time.Instant
import kotlin.uuid.Uuid
import kotlinx.serialization.json.Json
import org.javafreedom.kbeatz.catalog.api.models.ErrorResponse
import org.javafreedom.kbeatz.catalog.domain.port.SyncProvider
import org.javafreedom.kbeatz.common.ImageQuotaExhaustedException

class SyncHandlerTest {

    private val syncService: SyncProvider = mockk()
    private val albumId = Uuid.random()
    private val libraryRoot = Path.of("/music")

    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun `should return 503 with generic message when sync throws unexpected exception`() = testApplication {
        coEvery { syncService.sync(albumId, any()) } throws RuntimeException("DB connection timeout - secrets leaked here")

        install(ContentNegotiation) { json(json) }
        routing { syncRoutes(syncService, libraryRoot) }

        val client = createClient {
            install(ClientContentNegotiation) { json(json) }
        }

        val response = client.post("/albums/$albumId/sync") {
            contentType(ContentType.Application.Json)
            setBody("{}")
        }

        assertEquals(HttpStatusCode.ServiceUnavailable, response.status)
        val body = response.body<ErrorResponse>()
        assertEquals("SYNC_FAILED", body.code)
        assertFalse(
            body.message.contains("DB connection timeout"),
            "Response must not leak internal exception message: ${body.message}",
        )
        assertFalse(
            body.message.contains("secrets leaked"),
            "Response must not leak internal exception message: ${body.message}",
        )
    }

    @Test
    fun `should return 503 message directing client to check server logs`() = testApplication {
        coEvery { syncService.sync(albumId, any()) } throws RuntimeException("internal error")

        install(ContentNegotiation) { json(json) }
        routing { syncRoutes(syncService, libraryRoot) }

        val client = createClient {
            install(ClientContentNegotiation) { json(json) }
        }

        val response = client.post("/albums/$albumId/sync") {
            contentType(ContentType.Application.Json)
            setBody("{}")
        }

        assertEquals(HttpStatusCode.ServiceUnavailable, response.status)
        val body = response.body<ErrorResponse>()
        assertFalse(body.message.isBlank(), "Response message should not be blank")
        assertEquals("Sync failed - check server logs for details", body.message)
    }

    @Test
    fun `should return 429 with Retry-After header when image quota is exhausted`() = testApplication {
        val resetAt = "2026-06-19T00:01:00Z"
        coEvery { syncService.sync(albumId, any()) } throws ImageQuotaExhaustedException(resetAt)

        install(ContentNegotiation) { json(json) }
        routing { syncRoutes(syncService, libraryRoot) }

        val client = createClient {
            install(ClientContentNegotiation) { json(json) }
        }

        val response = client.post("/albums/$albumId/sync") {
            contentType(ContentType.Application.Json)
            setBody("{\"downloadImages\":true}")
        }

        assertEquals(HttpStatusCode.TooManyRequests, response.status)
        val retryAfter = response.headers[HttpHeaders.RetryAfter]
        assertNotNull(retryAfter, "Response must include Retry-After header")
        val retryAfterSeconds = retryAfter.toLongOrNull()
        assertNotNull(retryAfterSeconds, "Retry-After must be an integer number of seconds")
        assert(retryAfterSeconds >= 0) { "Retry-After must be non-negative, was: $retryAfterSeconds" }
    }

    @Test
    fun `computeRetryAfterSeconds returns correct seconds for future reset time`() {
        val fixedNow = Instant.parse("2026-06-19T00:00:00Z")
        val clock = object : Clock {
            override fun now(): Instant = fixedNow
        }
        val resetAt = "2026-06-19T00:01:00Z" // 60 seconds later
        val result = computeRetryAfterSeconds(resetAt, clock)
        assertEquals(60L, result)
    }

    @Test
    fun `computeRetryAfterSeconds returns zero when reset time is in the past`() {
        val fixedNow = Instant.parse("2026-06-19T01:00:00Z")
        val clock = object : Clock {
            override fun now(): Instant = fixedNow
        }
        val resetAt = "2026-06-19T00:00:00Z" // 1 hour in the past
        val result = computeRetryAfterSeconds(resetAt, clock)
        assertEquals(0L, result)
    }

    @Test
    fun `computeRetryAfterSeconds returns fallback when resetAt is unparseable`() {
        val result = computeRetryAfterSeconds("not-a-valid-timestamp")
        assert(result >= 0) { "Result must be non-negative" }
    }
}
