package org.javafreedom.kbeatz.catalog

import io.ktor.client.call.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.testing.*
import org.javafreedom.kbeatz.catalog.api.models.HealthResponse
import kotlin.test.Test
import kotlin.test.assertEquals

class HealthEndpointTest {
    @Test
    fun `GET health returns 200 UP`() = testApplication {
        application { module() }
        val client = createClient {
            install(ContentNegotiation) { json() }
        }
        val response = client.get("/api/v1/health")
        assertEquals(HttpStatusCode.OK, response.status)
        val body = response.body<HealthResponse>()
        assertEquals(HealthResponse.Status.UP, body.status)
    }

    @Test
    fun `unknown route returns 404`() = testApplication {
        application { module() }
        val response = client.get("/api/v1/nonexistent")
        assertEquals(HttpStatusCode.NotFound, response.status)
    }
}
