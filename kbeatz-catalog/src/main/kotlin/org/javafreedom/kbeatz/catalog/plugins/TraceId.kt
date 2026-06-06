package org.javafreedom.kbeatz.catalog.plugins

import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationPlugin
import io.ktor.server.application.createApplicationPlugin
import io.ktor.server.application.install
import io.ktor.server.request.header
import io.ktor.util.AttributeKey
import org.slf4j.MDC
import java.util.UUID

val TraceIdKey = AttributeKey<String>("TraceId")

val TraceIdPlugin: ApplicationPlugin<Unit> = createApplicationPlugin("TraceIdPlugin") {
    onCall { call ->
        val traceId = call.request.header("X-Trace-Id") ?: UUID.randomUUID().toString()
        call.attributes.put(TraceIdKey, traceId)
        MDC.put("traceId", traceId)
    }
    onCallRespond { call, _ ->
        call.attributes.getOrNull(TraceIdKey)?.let { traceId ->
            call.response.headers.append("X-Trace-Id", traceId)
        }
        MDC.remove("traceId")
    }
}

fun Application.configureLogging() {
    install(TraceIdPlugin)
}
