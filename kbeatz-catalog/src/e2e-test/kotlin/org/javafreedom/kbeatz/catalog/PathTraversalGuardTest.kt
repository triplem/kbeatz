package org.javafreedom.kbeatz.catalog

import io.ktor.client.request.get
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import org.javafreedom.kbeatz.catalog.plugins.configurePathTraversalGuard
import org.javafreedom.kbeatz.catalog.plugins.configureRouting
import org.javafreedom.kbeatz.catalog.plugins.configureSerialization
import org.javafreedom.kbeatz.catalog.plugins.configureStatusPages
import kotlin.test.Test
import kotlin.test.assertEquals

class PathTraversalGuardTest {

    private fun ApplicationTestBuilder.setupApp() {
        application {
            configurePathTraversalGuard()
            configureSerialization()
            configureStatusPages()
            configureRouting()
        }
    }

    @Test
    fun `raw dot-dot path returns 400`() = testApplication {
        setupApp()
        val response = client.get("/api/v1/albums/../../../etc/passwd")
        assertEquals(HttpStatusCode.BadRequest, response.status)
    }

    @Test
    fun `percent-encoded dot-dot returns 400`() = testApplication {
        setupApp()
        val response = client.get("/api/v1/albums/%2E%2E%2F%2E%2E%2Fetc%2Fpasswd")
        assertEquals(HttpStatusCode.BadRequest, response.status)
    }

    @Test
    fun `normal health request is not blocked`() = testApplication {
        setupApp()
        val response = client.get("/api/v1/health")
        assertEquals(HttpStatusCode.OK, response.status)
    }

    @Test
    fun `UUID path parameter is not blocked`() = testApplication {
        setupApp()
        val response = client.get("/api/v1/albums/550e8400-e29b-41d4-a716-446655440000")
        // 404 is fine — guard passed, handler returned not-found
        assert(response.status != HttpStatusCode.BadRequest) {
            "UUID path should not be blocked but got ${response.status}"
        }
    }
}
