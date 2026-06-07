package org.javafreedom.kbeatz.catalog.adapters.inbound.web.albums

import io.ktor.client.call.body
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation as ClientContentNegotiation
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.routing.routing
import io.ktor.server.testing.testApplication
import io.mockk.coEvery
import io.mockk.mockk
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.uuid.Uuid
import kotlinx.serialization.json.Json
import org.javafreedom.kbeatz.catalog.api.models.ErrorResponse
import org.javafreedom.kbeatz.catalog.application.service.DiscogsSyncService

class SyncHandlerTest {

    private val syncService: DiscogsSyncService = mockk()
    private val albumId = Uuid.random()

    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun `should return 503 with generic message when sync throws unexpected exception`() = testApplication {
        coEvery { syncService.sync(albumId, any()) } throws RuntimeException("DB connection timeout — secrets leaked here")

        install(ContentNegotiation) { json(json) }
        routing { syncRoutes(syncService) }

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
        routing { syncRoutes(syncService) }

        val client = createClient {
            install(ClientContentNegotiation) { json(json) }
        }

        val response = client.post("/albums/$albumId/sync") {
            contentType(ContentType.Application.Json)
            setBody("{}")
        }

        assertEquals(HttpStatusCode.ServiceUnavailable, response.status)
        val body = response.body<ErrorResponse>()
        assertFalse(body.message.isNullOrBlank(), "Response message should not be blank")
        assertEquals("Discogs sync failed — check server logs for details", body.message)
    }
}
