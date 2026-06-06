package org.javafreedom.kbeatz.catalog

import io.ktor.client.call.body
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.get
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.testing.testApplication
import org.javafreedom.kbeatz.catalog.api.models.AlbumPage
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class AlbumsEndpointTest {

    @Test
    fun `GET albums returns 200 with empty page when no albums indexed`() = testApplication {
        application { module() }
        val client = createClient { install(ContentNegotiation) { json() } }

        val response = client.get("/api/v1/albums")

        assertEquals(HttpStatusCode.OK, response.status)
        val body = response.body<AlbumPage>()
        assertNotNull(body.content)
        assertEquals(0, body.page)
        assertTrue(body.totalElements >= 0)
    }

    @Test
    fun `GET albums with page and size parameters returns paginated response`() = testApplication {
        application { module() }
        val client = createClient { install(ContentNegotiation) { json() } }

        val response = client.get("/api/v1/albums?page=0&size=10")

        assertEquals(HttpStatusCode.OK, response.status)
        val body = response.body<AlbumPage>()
        assertEquals(0, body.page)
        assertEquals(10, body.propertySize)
    }
}
