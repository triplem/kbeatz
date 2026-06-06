package org.javafreedom.kbeatz.catalog.application.service

import io.github.oshai.kotlinlogging.KotlinLogging
import java.io.IOException
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardCopyOption
import java.time.Clock
import java.time.LocalDate
import java.time.ZoneOffset
import kotlinx.io.files.Path as KtPath
import org.javafreedom.kbeatz.common.ImageQuotaExhaustedException
import org.javafreedom.kbeatz.sources.MetadataSource
import org.javafreedom.kbeatz.sources.discogs.DiscogsImageQuota
import org.javafreedom.kbeatz.tagger.codec.flac.FlacFile
import org.javafreedom.kbeatz.tagger.codec.flac.FlacMetadataBlock

private val log = KotlinLogging.logger {}

/**
 * Downloads and writes cover art for an album directory.
 *
 * ## Embed strategy
 *
 * Controlled by [embedInFiles]:
 * - `true` (default): writes `folder.jpg` AND embeds `METADATA_BLOCK_PICTURE` type 3 in every FLAC file.
 * - `false`: writes `folder.jpg` only; FLAC files are not modified.
 *
 * ## Quota check
 *
 * [imageQuota.canDownload] is checked before any HTTP call. If the quota is exhausted,
 * [ImageQuotaExhaustedException] is thrown immediately — no download or write occurs.
 *
 * @param metadataSource Source for downloading images.
 * @param imageQuota Daily image quota tracker. Checked before download; incremented by the source.
 * @param embedInFiles When true, embeds the image in FLAC files in addition to writing folder image.
 * @param clock Clock for computing quota reset time (UTC midnight tomorrow).
 */
class DiscogsImageService(
    private val metadataSource: MetadataSource,
    private val imageQuota: DiscogsImageQuota,
    val embedInFiles: Boolean = true,
    private val clock: Clock = Clock.systemUTC(),
) {

    /**
     * Downloads the primary image for [discogsId] and writes it to [albumDir].
     *
     * @param discogsId The Discogs release ID to fetch the image for.
     * @param albumDir The album directory to write into.
     * @param downloadImages When false, this method is a no-op (returns false).
     * @return true if an image was written, false if [downloadImages]=false or no image available.
     * @throws ImageQuotaExhaustedException if the daily quota is exhausted.
     */
    suspend fun downloadAndWrite(
        discogsId: String,
        albumDir: Path,
        downloadImages: Boolean,
    ): Boolean = when {
        !downloadImages -> {
            log.debug { "downloadImages=false — skipping image download for release $discogsId" }
            false
        }
        else -> doDownloadAndWrite(discogsId, albumDir)
    }

    private suspend fun doDownloadAndWrite(discogsId: String, albumDir: Path): Boolean {
        checkQuota(discogsId)

        val imageResult = metadataSource.fetchImage(discogsId, 0) ?: run {
            log.info { "No primary image available for release $discogsId" }
            return false
        }

        val imageBytes = imageResult.bytes.toByteArray()
        val extension = if (imageResult.mimeType == "image/png") "png" else "jpg"
        val folderImageName = "folder.$extension"

        writeFolderImage(albumDir, folderImageName, imageBytes)
        log.info { "Written $folderImageName for release $discogsId in $albumDir" }

        if (embedInFiles) {
            val picture = FlacMetadataBlock.Picture(
                pictureType = FlacMetadataBlock.Picture.TYPE_FRONT_COVER,
                mimeType = imageResult.mimeType,
                description = "",
                width = 0, height = 0, colorDepth = 0, colorCount = 0,
                data = imageResult.bytes,
            )
            embedPictureInFlacFiles(albumDir, picture, discogsId)
        }

        return true
    }

    private fun checkQuota(discogsId: String) {
        if (!imageQuota.canDownload()) {
            val resetAt = computeResetAt()
            log.warn { "Discogs image quota exhausted for release $discogsId — resetAt=$resetAt" }
            throw ImageQuotaExhaustedException(resetAt)
        }
    }

    private fun embedPictureInFlacFiles(albumDir: Path, picture: FlacMetadataBlock.Picture, discogsId: String) {
        findFlacFiles(albumDir).forEach { flacPath -> embedInSingleFile(flacPath, picture) }
        log.info { "Embedded cover art in FLAC files for release $discogsId in $albumDir" }
    }

    private fun embedInSingleFile(flacPath: Path, picture: FlacMetadataBlock.Picture) {
        try {
            FlacFile.read(KtPath(flacPath.toString()))
                .withPicture(picture)
                .writeTo(KtPath(flacPath.toString()))
            log.debug { "Embedded PICTURE in $flacPath" }
        } catch (ex: IOException) {
            log.error(ex) { "Failed to embed PICTURE in $flacPath — continuing with remaining files" }
        }
    }

    private fun writeFolderImage(albumDir: Path, filename: String, bytes: ByteArray) {
        val target = albumDir.resolve(filename)
        val tmp = albumDir.resolve("$filename.tmp")
        Files.write(tmp, bytes)
        Files.move(tmp, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
    }

    private fun findFlacFiles(albumDir: Path): List<Path> =
        if (Files.isDirectory(albumDir)) {
            Files.list(albumDir)
                .filter { it.fileName.toString().endsWith(".flac", ignoreCase = true) }
                .sorted()
                .toList()
        } else {
            emptyList()
        }

    private fun computeResetAt(): String =
        LocalDate.now(clock).plusDays(1)
            .atStartOfDay(ZoneOffset.UTC)
            .toInstant()
            .toString()
}
