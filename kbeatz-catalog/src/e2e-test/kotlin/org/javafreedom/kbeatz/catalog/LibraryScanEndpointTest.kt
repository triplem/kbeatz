package org.javafreedom.kbeatz.catalog

import io.ktor.client.call.body
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.testing.testApplication
import org.javafreedom.kbeatz.catalog.api.models.ScanStatus
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull

class LibraryScanEndpointTest {

    @Test
    fun `POST library scan returns 202 Accepted with RUNNING or IDLE state`() = testApplication {
        application { module() }
        val client = createClient { install(ContentNegotiation) { json() } }

        val response = client.post("/api/v1/library/scan")

        assertEquals(HttpStatusCode.Accepted, response.status)
        val body = response.body<ScanStatus>()
        assertNotNull(body.state)
    }

    @Test
    fun `GET library scan status returns 200 with scan status`() = testApplication {
        application { module() }
        val client = createClient { install(ContentNegotiation) { json() } }

        val response = client.get("/api/v1/library/scan/status")

        assertEquals(HttpStatusCode.OK, response.status)
        val body = response.body<ScanStatus>()
        assertNotNull(body.state)
    }
}
