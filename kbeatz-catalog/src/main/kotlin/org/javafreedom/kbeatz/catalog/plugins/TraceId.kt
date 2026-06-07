package org.javafreedom.kbeatz.catalog.plugins

import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationCallPipeline
import io.ktor.server.application.ApplicationPlugin
import io.ktor.server.application.Hook
import io.ktor.server.application.createApplicationPlugin
import io.ktor.server.application.install
import io.ktor.server.request.header
import io.ktor.util.AttributeKey
import java.util.UUID
import kotlinx.coroutines.slf4j.MDCContext
import kotlinx.coroutines.withContext
import org.slf4j.MDC

val TraceIdKey = AttributeKey<String>("TraceId")

/**
 * Hook that wraps the entire call pipeline in [MDCContext] so that MDC values set on the
 * current thread (e.g. `traceId`) are propagated across coroutine suspension boundaries.
 *
 * Without this, `MDC.put("traceId", ...)` is ThreadLocal and will be lost when Ktor suspends
 * and resumes on a different thread (e.g. inside `suspendTransaction {}`).
 */
private object MdcContextHook : Hook<suspend () -> Unit> {
    override fun install(pipeline: ApplicationCallPipeline, handler: suspend () -> Unit) {
        pipeline.intercept(ApplicationCallPipeline.Setup) {
            withContext(MDCContext()) {
                proceed()
            }
        }
    }
}

val TraceIdPlugin: ApplicationPlugin<Unit> = createApplicationPlugin("TraceIdPlugin") {
    on(MdcContextHook) {}

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
