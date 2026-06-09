package org.javafreedom.kbeatz.sources.discogs

import io.github.oshai.kotlinlogging.KotlinLogging
import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.engine.cio.*
import io.ktor.client.plugins.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlin.time.Clock
import kotlinx.io.bytestring.ByteString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.javafreedom.kbeatz.common.metadata.KbeatzMetadata
import org.javafreedom.kbeatz.common.metadata.KbeatzMetadata.Image as KbeatzImage
import org.javafreedom.kbeatz.sources.ImageResult
import org.javafreedom.kbeatz.sources.MetadataCache
import org.javafreedom.kbeatz.sources.MetadataSource
import org.javafreedom.kbeatz.sources.Release
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardCopyOption

private val log = KotlinLogging.logger {}

private val metadataJson = Json { ignoreUnknownKeys = true }
private val prettyJson = Json { prettyPrint = true }

/** Default Discogs rate-limit retry interval in seconds when the Retry-After header is absent. */
private const val DEFAULT_RETRY_AFTER_SECONDS = 60L

/** Milliseconds per second - used to convert Retry-After (seconds) to milliseconds. */
private const val MS_PER_SECOND = 1_000L

/**
 * Pattern that only allows alphanumeric characters and hyphens in a Discogs release ID.
 * Discogs release IDs are numeric (e.g. "12345678") but we allow hyphens for future compatibility.
 * Any other character (dots, slashes, etc.) would indicate a malformed or crafted ID.
 */
private val SAFE_RELEASE_ID_PATTERN = Regex("""^[a-zA-Z0-9\-]+$""")

/**
 * Discogs REST API adapter for [MetadataSource].
 *
 * Authentication: Personal Access Token via DISCOGS_TOKEN environment variable.
 * Rate limiting: 60 requests/minute enforced by a [DiscogsTokenBucket] - callers are suspended,
 * not rejected, when the bucket is empty.
 * Image quota: 1 000 images/day tracked by [DiscogsImageQuota].
 *
 * @param token Discogs Personal Access Token (from DISCOGS_TOKEN env var).
 * @param userAgent User-Agent header sent with every request.
 * @param imageQuota Daily image download quota tracker.
 * @param tokenBucket Token-bucket rate limiter (60 req/min).
 * @param cache Optional metadata cache; when provided, [fetchRelease] checks the cache before
 *   making an API call and stores the result on a cache miss.
 */
class DiscogsMetadataSource private constructor(
    private val token: String,
    private val client: HttpClient,
    private val imageQuota: DiscogsImageQuota,
    private val tokenBucket: DiscogsTokenBucket,
    private val cache: MetadataCache? = null,
) : MetadataSource {

    constructor(
        token: String,
        userAgent: String = "kbeatz/1.0",
        imageQuota: DiscogsImageQuota = DiscogsImageQuota(),
        tokenBucket: DiscogsTokenBucket = DiscogsTokenBucket(),
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
        tokenBucket = tokenBucket,
        cache = cache,
    )

    companion object {
        /** Creates an instance with a pre-configured [HttpClient] (e.g. for testing or proxy use). */
        fun withHttpClient(
            token: String,
            httpClient: HttpClient,
            imageQuota: DiscogsImageQuota = DiscogsImageQuota(),
            tokenBucket: DiscogsTokenBucket = DiscogsTokenBucket(),
            cache: MetadataCache? = null,
        ): DiscogsMetadataSource = DiscogsMetadataSource(token, httpClient, imageQuota, tokenBucket, cache)
    }

    override val name = "discogs"

    override suspend fun fetchRelease(releaseId: String): Release? {
        cache?.get(name, releaseId)?.let { return it }
        tokenBucket.acquire()
        log.info { "Fetching Discogs release $releaseId" }
        val response: DiscogsRelease = client.get("https://api.discogs.com/releases/$releaseId").body()
        val release = response.toDomain()
        cache?.put(name, releaseId, release)
        return release
    }

    override suspend fun fetchImage(releaseId: String, index: Int): ImageResult? =
        if (!imageQuota.canDownload()) {
            log.warn { "Discogs daily image quota exhausted - skipping image download for release $releaseId" }
            null
        } else {
            fetchRelease(releaseId)
                ?.images
                ?.getOrNull(index)
                ?.let { image ->
                    tokenBucket.acquire()
                    val bytes = ByteString(client.get(image.uri).body<ByteArray>())
                    imageQuota.recordDownload()
                    val mimeType = if (image.uri.endsWith(".png")) "image/png" else "image/jpeg"
                    ImageResult(bytes, mimeType)
                }
        }

    /**
     * Fetches a Discogs release by [discogsId], persists the raw API JSON to
     * `<albumDir>/.kbeatz/source_discogs_<discogsId>.json`, transforms it to
     * [KbeatzMetadata] via [DiscogsToKbeatzMapper], and writes the result to
     * `<albumDir>/.kbeatz/metadata.json`.
     *
     * Both files are overwritten on re-sync so callers always get the freshest data.
     * The `.kbeatz/` directory is created if it does not exist.
     *
     * @param discogsId Discogs release identifier (e.g. "12345678").
     * @param albumDir Path to the album directory that will receive the `.kbeatz/` files.
     * @return [SyncResult.Success] with the path to the written `metadata.json`, or
     *   [SyncResult.RateLimitExceeded] / [SyncResult.Error] on failure.
     */
    @Suppress("TooGenericExceptionCaught") // network, IO, and serialization errors are all fatal for this call
    suspend fun syncAlbum(discogsId: String, albumDir: Path): SyncResult {
        require(SAFE_RELEASE_ID_PATTERN.matches(discogsId)) {
            "discogsId must contain only alphanumeric characters and hyphens: $discogsId"
        }
        return try {
            tokenBucket.acquire()
            log.info { "discogs_sync_start releaseId=$discogsId albumDir=$albumDir" }

            val response = client.get("https://api.discogs.com/releases/$discogsId")
            if (response.status == HttpStatusCode.TooManyRequests) {
                val retryAfterSec = response.headers["Retry-After"]?.toLongOrNull() ?: DEFAULT_RETRY_AFTER_SECONDS
                val retryAfterMs = retryAfterSec * MS_PER_SECOND
                log.warn { "discogs_sync_rate_limited releaseId=$discogsId retryAfterMs=$retryAfterMs" }
                return SyncResult.RateLimitExceeded(retryAfterMs)
            }

            val rawBytes = response.body<ByteArray>()
            val rawJson = rawBytes.toString(Charsets.UTF_8)
            val discogsRelease = metadataJson.decodeFromString(DiscogsRelease.serializer(), rawJson)

            val kbeatzDir = albumDir.resolve(".kbeatz")
            Files.createDirectories(kbeatzDir)

            writeAtomically(kbeatzDir.resolve("source_discogs_$discogsId.json"), rawJson)

            val metadata = DiscogsToKbeatzMapper.map(discogsRelease, Clock.System.now())
            val metadataContent = prettyJson.encodeToString(metadata)
            val metadataFile = kbeatzDir.resolve("metadata.json")
            writeAtomically(metadataFile, metadataContent)

            log.info { "discogs_sync_done releaseId=$discogsId metadataPath=$metadataFile" }
            SyncResult.Success(metadataFile)
        } catch (ex: Exception) {
            log.error(ex) { "discogs_sync_error releaseId=$discogsId" }
            SyncResult.Error(ex)
        }
    }

    private fun writeAtomically(target: Path, content: String) {
        val tmp = target.resolveSibling(target.fileName.toString() + ".tmp")
        Files.writeString(tmp, content)
        Files.move(tmp, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
    }

    /**
     * Downloads images listed in `<albumDir>/.kbeatz/metadata.json` for the requested picture types.
     *
     * For each entry in [requestedTypes]:
     * - If the metadata.json does not contain an image for the type, a [ImageDownloadResult.Skipped]
     *   result is returned.
     * - If [overwriteExisting] is false (default) and the target file already exists, a
     *   [ImageDownloadResult.Skipped] result is returned.
     * - If the daily image quota is exhausted, a [ImageDownloadResult.QuotaExceeded] result is
     *   returned and no bytes are written.
     * - Otherwise, the image is downloaded and written atomically to `<albumDir>/<localPath>`.
     *
     * Rate limiting (1 req/sec) is enforced via the shared [DiscogsTokenBucket].
     * Quota tracking is handled by the shared [DiscogsImageQuota].
     *
     * @param albumDir Path to the album directory. The `.kbeatz/metadata.json` file must exist.
     * @param requestedTypes FLAC picture-type integers to download (e.g. setOf(3) for front cover).
     * @param overwriteExisting When true, overwrite existing target files. Default: false.
     * @return One [ImageDownloadResult] per requested type, in the same order as [requestedTypes].
     */
    suspend fun downloadImages(
        albumDir: Path,
        requestedTypes: Set<Int>,
        overwriteExisting: Boolean = false,
    ): List<ImageDownloadResult> {
        val metadataFile = albumDir.resolve(".kbeatz/metadata.json")
        val metadata = loadMetadata(metadataFile)
        return if (metadata == null) {
            requestedTypes.map { type ->
                ImageDownloadResult.Skipped(type, "metadata.json not found at $metadataFile")
            }
        } else {
            requestedTypes.map { type ->
                downloadImageForType(albumDir, metadata, type, overwriteExisting)
            }
        }
    }

    private suspend fun downloadImageForType(
        albumDir: Path,
        metadata: KbeatzMetadata,
        pictureType: Int,
        overwriteExisting: Boolean,
    ): ImageDownloadResult =
        metadata.images.firstOrNull { it.pictureType == pictureType }
            ?.let { entry -> resolveDownload(albumDir, entry, pictureType, overwriteExisting) }
            ?: ImageDownloadResult.Skipped(pictureType, "no image with pictureType=$pictureType in metadata.json")

    private suspend fun resolveDownload(
        albumDir: Path,
        entry: KbeatzImage,
        pictureType: Int,
        overwriteExisting: Boolean,
    ): ImageDownloadResult {
        val targetPath = albumDir.resolve(entry.localPath).normalize()
        if (!targetPath.startsWith(albumDir.normalize())) {
            log.warn { "Path traversal blocked: pictureType=$pictureType localPath=${entry.localPath}" }
            return ImageDownloadResult.Skipped(pictureType, "localPath escapes album directory")
        }
        return when {
            !overwriteExisting && Files.exists(targetPath) -> {
                log.debug { "Skipping pictureType=$pictureType localPath=${entry.localPath} already exists" }
                ImageDownloadResult.Skipped(pictureType, "file already exists at $targetPath")
            }
            !imageQuota.canDownload() -> {
                log.warn { "Discogs daily image quota exhausted - pictureType=$pictureType uri=${entry.sourceUri}" }
                ImageDownloadResult.QuotaExceeded(pictureType)
            }
            else -> performDownload(entry, pictureType, targetPath)
        }
    }

    private suspend fun performDownload(
        entry: KbeatzImage,
        pictureType: Int,
        targetPath: Path,
    ): ImageDownloadResult.Downloaded {
        log.info { "Downloading pictureType=$pictureType uri=${entry.sourceUri} target=$targetPath" }
        tokenBucket.acquire()
        val bytes = client.get(entry.sourceUri).body<ByteArray>()
        imageQuota.recordDownload()

        Files.createDirectories(targetPath.parent)
        val tmp = targetPath.resolveSibling(targetPath.fileName.toString() + ".tmp")
        Files.write(tmp, bytes)
        Files.move(tmp, targetPath, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)

        log.info { "Downloaded pictureType=$pictureType localPath=${entry.localPath} bytes=${bytes.size}" }
        return ImageDownloadResult.Downloaded(pictureType, targetPath)
    }

    @Suppress("TooGenericExceptionCaught") // IO errors reading metadata.json must not crash the caller
    private fun loadMetadata(metadataFile: Path): KbeatzMetadata? =
        try {
            if (!Files.exists(metadataFile)) {
                log.warn { "metadata.json not found at $metadataFile" }
                null
            } else {
                metadataJson.decodeFromString(KbeatzMetadata.serializer(), Files.readString(metadataFile))
            }
        } catch (ex: Exception) {
            log.warn(ex) { "Failed to parse metadata.json at $metadataFile" }
            null
        }
}
