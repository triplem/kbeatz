package org.javafreedom.kbeatz.catalog

import io.ktor.client.call.body
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.get
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.testing.testApplication
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import org.javafreedom.kbeatz.catalog.api.models.ErrorResponse

class StatusPagesTest {

    /**
     * A non-existent album UUID causes the handler to throw [ResourceNotFoundException],
     * which StatusPages maps to 404 - verifies the named-exception handler works.
     */
    @Test
    fun `ResourceNotFoundException returns 404 with RESOURCE_NOT_FOUND code`() = testApplication {
        application { module() }
        val client = createClient { install(ContentNegotiation) { json() } }

        val response = client.get("/api/v1/albums/00000000-0000-0000-0000-000000000001")

        assertEquals(HttpStatusCode.NotFound, response.status)
        val body = response.body<ErrorResponse>()
        assertEquals("RESOURCE_NOT_FOUND", body.code)
    }

    /**
     * Verifies that the error response body uses the generic message and does not
     * leak any internal exception detail to the caller.
     */
    @Test
    fun `404 error body message does not expose raw exception message`() = testApplication {
        application { module() }
        val client = createClient { install(ContentNegotiation) { json() } }

        val response = client.get("/api/v1/albums/00000000-0000-0000-0000-000000000002")

        assertEquals(HttpStatusCode.NotFound, response.status)
        val body = response.body<ErrorResponse>()
        // code is domain-specific, not a raw exception class name
        assertEquals("RESOURCE_NOT_FOUND", body.code)
        // message must be the static generic string, never the raw exception message
        assertEquals("Resource not found", body.message)
        assertFalse(body.message.contains("Album"), "entity type must not leak into error response")
    }
}
