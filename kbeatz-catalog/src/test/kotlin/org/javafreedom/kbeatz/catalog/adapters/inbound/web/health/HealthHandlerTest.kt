package org.javafreedom.kbeatz.catalog.adapters.inbound.web.health

import io.ktor.client.call.body
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation as ClientContentNegotiation
import io.ktor.client.request.get
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.routing.routing
import io.ktor.server.testing.testApplication
import java.nio.file.Files
import java.nio.file.Path
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlinx.serialization.json.Json
import org.javafreedom.kbeatz.catalog.api.models.HealthResponse

class HealthHandlerTest {

    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun `should return 200 UP when db and filesystem are healthy`() = testApplication {
        val existingDir = Files.createTempDirectory("health-test")

        install(ContentNegotiation) { json(json) }
        routing {
            healthRoutes(
                dbProbe = { true },
                libraryRoot = existingDir,
            )
        }

        val client = createClient { install(ClientContentNegotiation) { json(json) } }
        val response = client.get("/health")

        assertEquals(HttpStatusCode.OK, response.status)
        val body = response.body<HealthResponse>()
        assertEquals(HealthResponse.Status.UP, body.status)
        assertEquals("UP", body.details?.get("database"))
        assertEquals("UP", body.details?.get("filesystem"))
    }

    @Test
    fun `should return 503 DOWN when db probe fails`() = testApplication {
        val existingDir = Files.createTempDirectory("health-test")

        install(ContentNegotiation) { json(json) }
        routing {
            healthRoutes(
                dbProbe = { throw RuntimeException("DB connection refused") },
                libraryRoot = existingDir,
            )
        }

        val client = createClient { install(ClientContentNegotiation) { json(json) } }
        val response = client.get("/health")

        assertEquals(HttpStatusCode.ServiceUnavailable, response.status)
        val body = response.body<HealthResponse>()
        assertEquals(HealthResponse.Status.DOWN, body.status)
        assertEquals("DOWN", body.details?.get("database"))
        assertEquals("UP", body.details?.get("filesystem"))
    }

    @Test
    fun `should return 503 DOWN when library root does not exist`() = testApplication {
        val nonExistentDir = Path.of("/tmp/health-test-does-not-exist-${System.nanoTime()}")

        install(ContentNegotiation) { json(json) }
        routing {
            healthRoutes(
                dbProbe = { true },
                libraryRoot = nonExistentDir,
            )
        }

        val client = createClient { install(ClientContentNegotiation) { json(json) } }
        val response = client.get("/health")

        assertEquals(HttpStatusCode.ServiceUnavailable, response.status)
        val body = response.body<HealthResponse>()
        assertEquals(HealthResponse.Status.DOWN, body.status)
        assertEquals("UP", body.details?.get("database"))
        assertEquals("DOWN", body.details?.get("filesystem"))
    }
}
