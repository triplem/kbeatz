package org.javafreedom.kbeatz.catalog.adapters.inbound.web.albums

import io.ktor.client.call.body
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation as ClientContentNegotiation
import io.ktor.client.request.get
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.routing.routing
import io.ktor.server.testing.testApplication
import io.mockk.coEvery
import io.mockk.mockk
import java.time.Instant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue
import kotlin.uuid.Uuid
import kotlinx.serialization.json.Json
import org.javafreedom.kbeatz.catalog.api.models.ErrorResponse
import org.javafreedom.kbeatz.catalog.application.service.CoverArtResult
import org.javafreedom.kbeatz.catalog.application.service.CoverArtService
import org.javafreedom.kbeatz.common.ResourceNotFoundException

class CoverArtHandlerTest {

    private val coverArtService: CoverArtService = mockk()
    private val albumId = Uuid.random()
    private val jpegBytes = byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte())

    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun `GET cover returns 200 with image bytes when cover art found`() = testApplication {
        install(ContentNegotiation) { json(json) }
        routing { coverArtRoutes(coverArtService) }

        coEvery { coverArtService.getCoverArt(albumId) } returns
            CoverArtResult(bytes = jpegBytes, mimeType = "image/jpeg")

        val response = client.get("/albums/$albumId/cover")

        assertEquals(HttpStatusCode.OK, response.status)
        assertTrue(response.body<ByteArray>().contentEquals(jpegBytes))
    }

    @Test
    fun `GET cover sends Cache-Control public max-age header`() = testApplication {
        install(ContentNegotiation) { json(json) }
        routing { coverArtRoutes(coverArtService) }

        coEvery { coverArtService.getCoverArt(albumId) } returns
            CoverArtResult(bytes = jpegBytes, mimeType = "image/jpeg")

        val response = client.get("/albums/$albumId/cover")

        assertEquals(HttpStatusCode.OK, response.status)
        val cacheControl = response.headers[HttpHeaders.CacheControl]
        assertNotNull(cacheControl)
        assertTrue(cacheControl.contains("public"), "Cache-Control must contain 'public'")
        assertTrue(cacheControl.contains("max-age=86400"), "Cache-Control must contain 'max-age=86400'")
    }

    @Test
    fun `GET cover sends Last-Modified header when lastModified is set`() = testApplication {
        install(ContentNegotiation) { json(json) }
        routing { coverArtRoutes(coverArtService) }

        val lastModified = Instant.parse("2024-05-01T12:00:00Z")
        coEvery { coverArtService.getCoverArt(albumId) } returns
            CoverArtResult(bytes = jpegBytes, mimeType = "image/jpeg", lastModified = lastModified)

        val response = client.get("/albums/$albumId/cover")

        assertEquals(HttpStatusCode.OK, response.status)
        assertNotNull(response.headers[HttpHeaders.LastModified], "Last-Modified header must be present")
    }

    @Test
    fun `GET cover does not send Last-Modified when lastModified is null`() = testApplication {
        install(ContentNegotiation) { json(json) }
        routing { coverArtRoutes(coverArtService) }

        coEvery { coverArtService.getCoverArt(albumId) } returns
            CoverArtResult(bytes = jpegBytes, mimeType = "image/jpeg", lastModified = null)

        val response = client.get("/albums/$albumId/cover")

        assertEquals(HttpStatusCode.OK, response.status)
        assertTrue(
            response.headers[HttpHeaders.LastModified] == null,
            "Last-Modified header must be absent when lastModified is null",
        )
    }

    @Test
    fun `GET cover returns 404 when cover art not found`() = testApplication {
        install(ContentNegotiation) { json(json) }
        routing { coverArtRoutes(coverArtService) }

        coEvery { coverArtService.getCoverArt(albumId) } returns null

        val response = client.get("/albums/$albumId/cover")
        val client2 = createClient { install(ClientContentNegotiation) { json(json) } }

        val response2 = client2.get("/albums/$albumId/cover")
        assertEquals(HttpStatusCode.NotFound, response2.status)
        val error = response2.body<ErrorResponse>()
        assertEquals("RESOURCE_NOT_FOUND", error.code)
    }

    @Test
    fun `GET cover returns 404 when album does not exist`() = testApplication {
        install(ContentNegotiation) { json(json) }
        routing { coverArtRoutes(coverArtService) }

        coEvery { coverArtService.getCoverArt(albumId) } throws ResourceNotFoundException("Album", albumId.toString())

        val client2 = createClient { install(ClientContentNegotiation) { json(json) } }
        val response = client2.get("/albums/$albumId/cover")

        assertEquals(HttpStatusCode.NotFound, response.status)
        val error = response.body<ErrorResponse>()
        assertEquals("RESOURCE_NOT_FOUND", error.code)
    }

    @Test
    fun `GET cover returns 400 when albumId is not a valid UUID`() = testApplication {
        install(ContentNegotiation) { json(json) }
        routing { coverArtRoutes(coverArtService) }

        val client2 = createClient { install(ClientContentNegotiation) { json(json) } }
        val response = client2.get("/albums/not-a-uuid/cover")

        assertEquals(HttpStatusCode.BadRequest, response.status)
        val error = response.body<ErrorResponse>()
        assertEquals("INVALID_PARAMETER", error.code)
    }

    @Test
    fun `GET cover returns 400 when path traversal is attempted`() = testApplication {
        install(ContentNegotiation) { json(json) }
        routing { coverArtRoutes(coverArtService) }

        coEvery { coverArtService.getCoverArt(albumId) } throws SecurityException("outside library root")

        val client2 = createClient { install(ClientContentNegotiation) { json(json) } }
        val response = client2.get("/albums/$albumId/cover")

        assertEquals(HttpStatusCode.BadRequest, response.status)
        val error = response.body<ErrorResponse>()
        assertEquals("INVALID_PATH", error.code)
    }
}
