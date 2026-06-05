package org.javafreedom.kbeatz.sources.discogs

import io.github.oshai.kotlinlogging.KotlinLogging
import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.engine.cio.*
import io.ktor.client.plugins.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.serialization.json.Json
import org.javafreedom.kbeatz.sources.ImageResult
import org.javafreedom.kbeatz.sources.MetadataSource
import org.javafreedom.kbeatz.sources.Release

private val log = KotlinLogging.logger {}

/**
 * Discogs REST API adapter for [MetadataSource].
 *
 * Authentication: Personal Access Token via DISCOGS_TOKEN environment variable.
 * Rate limiting: 60 requests/minute (metadata), 1 000 images/day.
 * Image quota is tracked in a JSON file; see [DiscogsImageQuota].
 *
 * @param token Discogs Personal Access Token (from DISCOGS_TOKEN env var).
 * @param userAgent User-Agent header sent with every request.
 * @param imageQuota Persistent daily image quota tracker.
 */
class DiscogsMetadataSource(
    private val token: String,
    private val userAgent: String = "kbeatz/1.0",
    private val imageQuota: DiscogsImageQuota = DiscogsImageQuota(),
) : MetadataSource {

    override val name = "discogs"

    private val client = HttpClient(CIO) {
        install(ContentNegotiation) {
            json(Json { ignoreUnknownKeys = true })
        }
        install(HttpRequestRetry) {
            retryOnServerErrors(maxRetries = 2)
            exponentialDelay()
        }
        defaultRequest {
            header("Authorization", "Discogs token=$token")
            header("User-Agent", userAgent)
        }
    }

    override suspend fun fetchRelease(releaseId: String): Release? {
        log.info { "Fetching Discogs release $releaseId" }
        val response: DiscogsRelease = client.get("https://api.discogs.com/releases/$releaseId").body()
        return response.toDomain()
    }

    override suspend fun fetchImage(releaseId: String, index: Int): ImageResult? {
        if (!imageQuota.canDownload()) {
            log.warn { "Discogs daily image quota exhausted — skipping image download for release $releaseId" }
            return null
        }
        val release = fetchRelease(releaseId) ?: return null
        val image = release.images.getOrNull(index) ?: return null
        val bytes = client.get(image.uri).body<ByteArray>()
        imageQuota.recordDownload()
        val mimeType = if (image.uri.endsWith(".png")) "image/png" else "image/jpeg"
        return ImageResult(bytes, mimeType)
    }
}
