package org.javafreedom.kbeatz.catalog.plugins

import io.github.oshai.kotlinlogging.KotlinLogging
import io.ktor.server.application.Application
import io.ktor.server.application.createApplicationPlugin
import io.ktor.server.application.hooks.ResponseSent
import io.ktor.server.application.install
import io.ktor.server.plugins.callid.CallId
import io.ktor.server.plugins.callid.callId
import io.ktor.server.plugins.callid.callIdMdc
import io.ktor.server.plugins.calllogging.CallLogging
import io.ktor.server.plugins.calllogging.processingTimeMillis
import io.ktor.server.request.httpMethod
import io.ktor.server.request.path
import java.util.UUID
import org.slf4j.event.Level

/** Request and response header carrying the correlation id. */
const val TRACE_ID_HEADER: String = "X-Trace-Id"

/** MDC key under which the correlation id is exposed to the structured logger. */
const val TRACE_ID_MDC_KEY: String = "traceId"

private const val SLOW_REQUEST_THRESHOLD_MS = 500L
private const val CLIENT_ERROR_STATUS = 400
private const val SERVER_ERROR_STATUS = 500
private const val UNKNOWN_STATUS = -1

private val accessLogger = KotlinLogging.logger("org.javafreedom.kbeatz.catalog.access")

/**
 * Installs request correlation and structured access logging using the stock Ktor
 * [CallId] and [CallLogging] plugins.
 *
 * [CallId] reads the correlation id from the [TRACE_ID_HEADER] request header, falls back
 * to a generated UUID, validates it, and echoes it back in the [TRACE_ID_HEADER] response
 * header. [CallLogging] copies the id into the MDC under [TRACE_ID_MDC_KEY] (Ktor
 * propagates the MDC across coroutine suspension boundaries) so every log line emitted
 * while handling the request carries the traceId.
 *
 * One access-log line is emitted per request by [AccessLogPlugin]. Its level follows
 * `.claude/rules/logging.md`: INFO for normal responses, WARN for slow (> 500 ms) or 4xx
 * responses, and ERROR for 5xx responses. CallLogging's own access line is suppressed via
 * a filter so the request is logged exactly once.
 *
 * Trust model note (v1): echoing server-generated UUIDs to all clients is acceptable on a
 * trusted LAN with no authentication. Before v2 internet-facing deployment this behaviour
 * should be re-evaluated - see the "Request Tracing" section in
 * kbeatz-catalog/docs/operations-guide.adoc.
 */
fun Application.configureLogging() {
    install(CallId) {
        retrieveFromHeader(TRACE_ID_HEADER)
        generate { UUID.randomUUID().toString() }
        verify { it.isNotBlank() }
        replyToHeader(TRACE_ID_HEADER)
    }

    install(CallLogging) {
        callIdMdc(TRACE_ID_MDC_KEY)
        // AccessLogPlugin emits the single access line at the correct level; suppress the
        // built-in CallLogging line so each request is logged exactly once.
        filter { false }
    }

    install(AccessLogPlugin)
}

/**
 * Emits one structured access-log line per completed request, choosing the log level from
 * the response status and processing time per `.claude/rules/logging.md`.
 */
val AccessLogPlugin = createApplicationPlugin("AccessLogPlugin") {
    on(ResponseSent) { call ->
        val method = call.request.httpMethod.value
        val path = call.request.path()
        val status = call.response.status()?.value ?: UNKNOWN_STATUS
        val durationMs = call.processingTimeMillis()
        val traceId = call.callId ?: "unknown"
        val message =
            "http_request traceId=$traceId method=$method path=$path status=$status durationMs=$durationMs"

        when (logLevelFor(status, durationMs)) {
            Level.ERROR -> accessLogger.error { message }
            Level.WARN -> accessLogger.warn { message }
            else -> accessLogger.info { message }
        }
    }
}

private fun logLevelFor(status: Int, durationMs: Long): Level = when {
    status >= SERVER_ERROR_STATUS || status < 0 -> Level.ERROR
    status >= CLIENT_ERROR_STATUS || durationMs > SLOW_REQUEST_THRESHOLD_MS -> Level.WARN
    else -> Level.INFO
}
