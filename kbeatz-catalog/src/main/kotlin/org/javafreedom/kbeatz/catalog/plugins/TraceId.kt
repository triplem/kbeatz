package org.javafreedom.kbeatz.catalog.plugins

import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationCallPipeline
import io.ktor.server.application.ApplicationPlugin
import io.ktor.server.application.Hook
import io.ktor.server.application.call
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
 * Hook that intercepts the pipeline at the Plugins phase to:
 * 1. Extract or generate a traceId from the request header
 * 2. Store it in MDC and in the call attributes
 * 3. Wrap the remaining pipeline in [MDCContext] so the traceId is propagated across
 *    coroutine suspension boundaries (e.g. when `suspendTransaction {}` switches threads)
 *
 * All three steps must happen in the same interceptor so the MDCContext snapshot is taken
 * AFTER the traceId is placed in MDC, not before.
 */
private object TraceIdAndMdcHook : Hook<suspend () -> Unit> {
    override fun install(pipeline: ApplicationCallPipeline, handler: suspend () -> Unit) {
        pipeline.intercept(ApplicationCallPipeline.Plugins) {
            val traceId = call.request.header("X-Trace-Id") ?: UUID.randomUUID().toString()
            call.attributes.put(TraceIdKey, traceId)
            MDC.put("traceId", traceId)
            try {
                withContext(MDCContext()) {
                    proceed()
                }
            } finally {
                MDC.remove("traceId")
            }
        }
    }
}

val TraceIdPlugin: ApplicationPlugin<Unit> = createApplicationPlugin("TraceIdPlugin") {
    on(TraceIdAndMdcHook) {}

    onCallRespond { call, _ ->
        call.attributes.getOrNull(TraceIdKey)?.let { traceId ->
            call.response.headers.append("X-Trace-Id", traceId)
        }
    }
}

fun Application.configureLogging() {
    install(TraceIdPlugin)
}
