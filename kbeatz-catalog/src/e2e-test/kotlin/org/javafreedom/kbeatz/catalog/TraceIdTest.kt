package org.javafreedom.kbeatz.catalog

import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.server.testing.testApplication
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull

class TraceIdTest {
    @Test
    fun `response echoes X-Trace-Id from request`() = testApplication {
        application { module() }
        val response = client.get("/api/v1/health") {
            header("X-Trace-Id", "test-trace-123")
        }
        assertEquals("test-trace-123", response.headers["X-Trace-Id"])
    }

    @Test
    fun `response generates UUID when X-Trace-Id absent`() = testApplication {
        application { module() }
        val response = client.get("/api/v1/health")
        val traceId = response.headers["X-Trace-Id"]
        assertNotNull(traceId)
        // UUID format: 8-4-4-4-12 hex chars
        assert(
            traceId.matches(Regex("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")),
        ) {
            "Expected UUID format but got: $traceId"
        }
    }
}
