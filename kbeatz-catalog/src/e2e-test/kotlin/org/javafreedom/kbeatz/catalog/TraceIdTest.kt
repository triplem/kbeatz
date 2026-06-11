package org.javafreedom.kbeatz.catalog

import ch.qos.logback.classic.Logger
import ch.qos.logback.classic.spi.ILoggingEvent
import ch.qos.logback.core.read.ListAppender
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.server.routing.get
import io.ktor.server.routing.routing
import io.ktor.server.testing.testApplication
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue
import io.ktor.http.HttpStatusCode
import io.ktor.server.response.respond
import org.javafreedom.kbeatz.catalog.plugins.configureLogging
import org.slf4j.LoggerFactory

class TraceIdTest {

    private val accessLogger = LoggerFactory.getLogger("org.javafreedom.kbeatz.catalog.access") as Logger
    private val appender = ListAppender<ILoggingEvent>()

    @BeforeTest
    fun attachAppender() {
        appender.start()
        accessLogger.addAppender(appender)
    }

    @AfterTest
    fun detachAppender() {
        accessLogger.detachAppender(appender)
        appender.stop()
    }

    @Test
    fun `response echoes X-Trace-Id from request`() = testApplication {
        application { module() }
        val response = client.get("/healthz") {
            header("X-Trace-Id", "test-trace-123")
        }
        assertEquals("test-trace-123", response.headers["X-Trace-Id"])
    }

    @Test
    fun `response generates UUID when X-Trace-Id absent`() = testApplication {
        application { module() }
        val response = client.get("/healthz")
        val traceId = response.headers["X-Trace-Id"]
        assertNotNull(traceId)
        // UUID format: 8-4-4-4-12 hex chars
        assert(
            traceId.matches(Regex("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")),
        ) {
            "Expected UUID format but got: $traceId"
        }
    }

    @Test
    fun `access log emits one structured INFO line with correlation fields for a 200 response`() = testApplication {
        application { module() }

        client.get("/healthz") { header("X-Trace-Id", "trace-access-200") }

        val event = appender.list.firstOrNull { it.message.startsWith("http_request") }
        assertNotNull(event, "Expected an http_request access log line to be emitted")
        val message = event.message
        assertTrue(message.contains("traceId=trace-access-200"), "Missing traceId in: $message")
        assertTrue(message.contains("method=GET"), "Missing method in: $message")
        assertTrue(message.contains("path=/healthz"), "Missing path in: $message")
        assertTrue(message.contains("status=200"), "Missing status in: $message")
        assertTrue(message.contains("durationMs="), "Missing durationMs in: $message")
        assertEquals("INFO", event.level.toString(), "Expected INFO level for a 200 response")
    }

    @Test
    fun `access log emits one WARN line for a 4xx response`() = testApplication {
        application { module() }

        client.get("/api/v1/albums/not-a-uuid") { header("X-Trace-Id", "trace-access-400") }

        val event = appender.list.firstOrNull {
            it.message.startsWith("http_request") && it.message.contains("status=400")
        }
        assertNotNull(event, "Expected an http_request access log line for the 4xx response")
        assertEquals("WARN", event.level.toString(), "Expected WARN level for a 4xx response")
        assertTrue(event.message.contains("traceId=trace-access-400"), "Missing traceId in: ${event.message}")
    }

    @Test
    fun `access log emits one ERROR line for a 5xx response`() = testApplication {
        application {
            configureLogging()
            routing {
                // respond directly to avoid needing serialization in this focused test
                get("/test/boom") { call.respond(HttpStatusCode.InternalServerError) }
            }
        }

        client.get("/test/boom") { header("X-Trace-Id", "trace-access-500") }

        val event = appender.list.firstOrNull {
            it.message.startsWith("http_request") && it.message.contains("status=500")
        }
        assertNotNull(event, "Expected an http_request access log line for the 5xx response")
        assertEquals("ERROR", event.level.toString(), "Expected ERROR level for a 5xx response")
        assertTrue(event.message.contains("traceId=trace-access-500"), "Missing traceId in: ${event.message}")
    }
}
