package org.javafreedom.kbeatz.sources.discogs

import io.github.oshai.kotlinlogging.KotlinLogging
import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.engine.cio.*
import io.ktor.client.plugins.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.io.bytestring.ByteString
import kotlinx.serialization.json.Json
import org.javafreedom.kbeatz.sources.ImageResult
import org.javafreedom.kbeatz.sources.MetadataCache
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
 * @param cache Optional metadata cache; when provided, [fetchRelease] checks the cache before
 *   making an API call and stores the result on a cache miss.
 */
class DiscogsMetadataSource private constructor(
    private val token: String,
    private val client: HttpClient,
    private val imageQuota: DiscogsImageQuota,
    private val cache: MetadataCache? = null,
) : MetadataSource {

    constructor(
        token: String,
        userAgent: String = "kbeatz/1.0",
        imageQuota: DiscogsImageQuota = DiscogsImageQuota(),
        cache: MetadataCache? = null,
    ) : this(
        token = token,
        client = HttpClient(CIO) {
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
        },
        imageQuota = imageQuota,
        cache = cache,
    )

    companion object {
        /** Creates an instance with a pre-configured [HttpClient] (e.g. for testing or proxy use). */
        fun withHttpClient(
            token: String,
            httpClient: HttpClient,
            imageQuota: DiscogsImageQuota = DiscogsImageQuota(),
            cache: MetadataCache? = null,
        ): DiscogsMetadataSource = DiscogsMetadataSource(token, httpClient, imageQuota, cache)
    }

    override val name = "discogs"

    override suspend fun fetchRelease(releaseId: String): Release? {
        cache?.get(name, releaseId)?.let { return it }
        log.info { "Fetching Discogs release $releaseId" }
        val response: DiscogsRelease = client.get("https://api.discogs.com/releases/$releaseId").body()
        val release = response.toDomain()
        cache?.put(name, releaseId, release)
        return release
    }

    override suspend fun fetchImage(releaseId: String, index: Int): ImageResult? =
        if (!imageQuota.canDownload()) {
            log.warn { "Discogs daily image quota exhausted — skipping image download for release $releaseId" }
            null
        } else {
            fetchRelease(releaseId)
                ?.images
                ?.getOrNull(index)
                ?.let { image ->
                    val bytes = ByteString(client.get(image.uri).body<ByteArray>())
                    imageQuota.recordDownload()
                    val mimeType = if (image.uri.endsWith(".png")) "image/png" else "image/jpeg"
                    ImageResult(bytes, mimeType)
                }
        }
}
