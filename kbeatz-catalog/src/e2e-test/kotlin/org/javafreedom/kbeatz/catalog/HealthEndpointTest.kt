package org.javafreedom.kbeatz.catalog

import io.ktor.client.call.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.testing.*
import org.javafreedom.kbeatz.catalog.api.models.HealthResponse
import org.javafreedom.kbeatz.catalog.api.models.LivenessResponse
import kotlin.test.Test
import kotlin.test.assertEquals

class HealthEndpointTest {
    @Test
    fun `GET healthz returns 200 UP`() = testApplication {
        application { module() }
        val client = createClient {
            install(ContentNegotiation) { json() }
        }
        val response = client.get("/healthz")
        assertEquals(HttpStatusCode.OK, response.status)
        val body = response.body<HealthResponse>()
        assertEquals(HealthResponse.Status.UP, body.status)
    }

    @Test
    fun `GET livez returns 200 UP`() = testApplication {
        application { module() }
        val client = createClient {
            install(ContentNegotiation) { json() }
        }
        val response = client.get("/livez")
        assertEquals(HttpStatusCode.OK, response.status)
        val body = response.body<LivenessResponse>()
        assertEquals(LivenessResponse.Status.UP, body.status)
    }

    @Test
    fun `GET readyz returns 200 UP when database is available`() = testApplication {
        application { module() }
        val client = createClient {
            install(ContentNegotiation) { json() }
        }
        val response = client.get("/readyz")
        assertEquals(HttpStatusCode.OK, response.status)
        val body = response.body<LivenessResponse>()
        assertEquals(LivenessResponse.Status.UP, body.status)
    }

    @Test
    fun `unknown route returns 404`() = testApplication {
        application { module() }
        val response = client.get("/api/v1/nonexistent")
        assertEquals(HttpStatusCode.NotFound, response.status)
    }
}
