package org.javafreedom.kbeatz.catalog.infrastructure.sync

import java.nio.file.Path
import org.javafreedom.kbeatz.catalog.AppConfig
import org.javafreedom.kbeatz.catalog.domain.port.SyncProvider
import org.javafreedom.kbeatz.catalog.application.service.DiscogsImageService
import org.javafreedom.kbeatz.catalog.application.service.DiscogsSyncService
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumRepository
import org.javafreedom.kbeatz.sources.ImageResult
import org.javafreedom.kbeatz.sources.MetadataSource
import org.javafreedom.kbeatz.sources.Release
import org.javafreedom.kbeatz.sources.discogs.DiscogsImageQuota
import org.javafreedom.kbeatz.sources.discogs.DiscogsMetadataSource
import org.javafreedom.kbeatz.sources.discogs.DiscogsTokenBucket

/** Placeholder used when DISCOGS_TOKEN is not configured. All calls throw immediately. */
private object UnavailableMetadataSource : MetadataSource {
    override val name = "discogs"
    override suspend fun fetchRelease(releaseId: String): Release? =
        error("Discogs sync unavailable - DISCOGS_TOKEN is not configured")
    override suspend fun fetchImage(releaseId: String, index: Int): ImageResult? =
        error("Discogs sync unavailable - DISCOGS_TOKEN is not configured")
}

/**
 * Wiring factory for the Discogs [SyncProvider].
 *
 * Isolates all concrete Discogs infrastructure (token, quota, rate-limiter) from
 * [org.javafreedom.kbeatz.catalog.Application]. When a second provider
 * (e.g. MusicBrainz) is added, a parallel factory function is placed here and swapped
 * in at wiring time without touching Application.kt.
 */
fun buildDiscogsSyncProvider(
    config: AppConfig,
    albumRepository: AlbumRepository,
    libraryRootPath: Path,
    dataDir: Path,
): SyncProvider {
    val token = config.discogsToken
    if (token == null) {
        return DiscogsSyncService(
            albumRepository = albumRepository,
            metadataSource = UnavailableMetadataSource,
            imageService = null,
            libraryRoot = libraryRootPath,
        )
    }
    val quotaFile = dataDir.resolve("discogs-image-quota.json")
    val imageQuota = DiscogsImageQuota(quotaFile = quotaFile)
    val metadataSource = DiscogsMetadataSource(
        token = token,
        imageQuota = imageQuota,
        tokenBucket = DiscogsTokenBucket(),
    )
    val imageService = DiscogsImageService(
        metadataSource = metadataSource,
        imageQuota = imageQuota,
    )
    return DiscogsSyncService(
        albumRepository = albumRepository,
        metadataSource = metadataSource,
        imageService = imageService,
        libraryRoot = libraryRootPath,
    )
}
