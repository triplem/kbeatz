package org.javafreedom.kbeatz.catalog.plugins

import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationPlugin
import io.ktor.server.application.createApplicationPlugin
import io.ktor.server.application.install
import io.ktor.server.request.contentLength
import io.ktor.server.response.respond
import org.javafreedom.kbeatz.catalog.api.models.ErrorResponse

/** 1 MB - maximum accepted request body size for tag write endpoints. */
const val MAX_REQUEST_BODY_BYTES: Long = 1_048_576L

/**
 * Rejects requests whose `Content-Length` header exceeds [MAX_REQUEST_BODY_BYTES].
 *
 * This is a defence-in-depth guard against accidental or malicious oversized payloads that
 * could exhaust heap memory during JSON deserialisation. The per-field length check in
 * [TagWriteService] is the primary validation; this plugin is the network-boundary guard.
 *
 * Requests without a `Content-Length` header (e.g. chunked transfer) are not rejected here
 * because the length is unknown at the call-receive phase. The service-layer check still
 * applies for those requests.
 */
val RequestBodySizeLimit: ApplicationPlugin<Unit> = createApplicationPlugin("RequestBodySizeLimit") {
    onCall { call ->
        call.request.contentLength()?.let { contentLength ->
            if (contentLength > MAX_REQUEST_BODY_BYTES) {
                call.respond(
                    HttpStatusCode.PayloadTooLarge,
                    ErrorResponse(
                        code = "REQUEST_TOO_LARGE",
                        message = "Request body exceeds the maximum allowed size of $MAX_REQUEST_BODY_BYTES bytes"
                    )
                )
            }
        }
    }
}

fun Application.configureRequestBodySizeLimit() {
    install(RequestBodySizeLimit)
}
