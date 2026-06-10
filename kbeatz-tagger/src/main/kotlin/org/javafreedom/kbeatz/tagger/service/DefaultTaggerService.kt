package org.javafreedom.kbeatz.tagger.service

import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.io.buffered
import kotlinx.io.bytestring.ByteString
import kotlinx.io.files.Path
import kotlinx.io.files.SystemFileSystem
import kotlinx.io.readByteArray
import org.javafreedom.kbeatz.common.FlacTrackCountMismatchException
import org.javafreedom.kbeatz.common.metadata.KbeatzMetadata
import org.javafreedom.kbeatz.sources.MetadataSource
import org.javafreedom.kbeatz.sources.Release
import org.javafreedom.kbeatz.tagger.codec.flac.FlacFile
import org.javafreedom.kbeatz.tagger.codec.flac.FlacMetadataBlock
import org.javafreedom.kbeatz.tagger.codec.flac.VorbisCommentEditor
import org.javafreedom.kbeatz.tagger.codec.flac.VorbisCommentFields
import org.javafreedom.kbeatz.tagger.idfile.IdFileReader
import org.javafreedom.kbeatz.tagger.idfile.SourceConfig

private val log = KotlinLogging.logger {}

private const val ROLE_COMPOSED_BY = "Composed By"
private const val ROLE_CONDUCTOR = "Conductor"
private const val ROLE_ORCHESTRA = "Orchestra"

class DefaultTaggerService(
    private val idReader: IdFileReader = IdFileReader(SourceConfig()),
    private val metadataSource: MetadataSource,
) : TaggerService {

    override suspend fun tagAlbum(albumDir: Path, downloadImages: Boolean): TagResult {
        log.info { "Tagging album $albumDir" }
        return when (val lookup = resolveRelease(albumDir)) {
            is Lookup.Missing -> {
                log.info { "Skipped $albumDir: ${lookup.reason}" }
                TagResult.Skipped(albumDir, lookup.reason)
            }
            is Lookup.Found -> runCatching {
                val picture = if (downloadImages) fetchCoverArt(lookup.discogsId) else null
                val files = findFlacFiles(albumDir)
                files.forEach { path -> tagFile(path, lookup.release, picture) }
                log.info { "Tagged $albumDir: ${files.size} FLAC files (discogs_id=${lookup.discogsId})" }
                TagResult.Tagged(albumDir, lookup.discogsId, files.size)
            }.getOrElse { e ->
                log.error(e) { "Failed to tag $albumDir" }
                TagResult.Failed(albumDir, e)
            }
        }
    }

    override fun tag(albumDir: Path, metadata: KbeatzMetadata): TagResult {
        log.info { "tag_start albumDir=$albumDir source=${metadata.source} sourceId=${metadata.sourceId}" }
        return runCatching {
            val pictures = resolveImages(albumDir, metadata.images)
            val discDirs = resolveDiscDirectories(albumDir, metadata.album.discTotal)
            var totalFiles = 0
            discDirs.forEachIndexed { index, discContext ->
                val discNumber = index + 1
                val discTracks = metadata.tracks.filter { it.discNumber == discNumber }
                FlacTrackCountValidator.validate(
                    albumDir = albumDir,
                    discDir = discContext.dir,
                    discNumber = discNumber,
                    expectedTrackCount = discTracks.size,
                )
                val flacFiles = listFlacFilesSorted(discContext.dir)
                flacFiles.forEachIndexed { trackIndex, flacPath ->
                    val track = discTracks[trackIndex]
                    tagFileFromMetadata(flacPath, metadata, track, pictures)
                }
                totalFiles += flacFiles.size
                log.info {
                    "tag_disc_done albumDir=$albumDir discNumber=$discNumber files=${flacFiles.size}"
                }
            }
            log.info { "tag_done albumDir=$albumDir totalFiles=$totalFiles" }
            TagResult.Tagged(albumDir, metadata.sourceId, totalFiles)
        }.getOrElse { e ->
            when (e) {
                is FlacTrackCountMismatchException -> {
                    log.error(e) {
                        "tag_mismatch albumDir=$albumDir disc=${e.discNumber} " +
                            "expected=${e.expectedTracks} actual=${e.actualFiles}"
                    }
                    TagResult.TrackCountMismatch(albumDir, e.discNumber, e.actualFiles, e.expectedTracks)
                }
                else -> {
                    log.error(e) { "tag_error albumDir=$albumDir" }
                    TagResult.Failed(albumDir, e)
                }
            }
        }
    }

    private fun resolveImages(albumDir: Path, images: List<KbeatzMetadata.Image>): List<FlacMetadataBlock.Picture> =
        images.mapNotNull { image ->
            // Reject paths with directory traversal components before constructing the full path.
            // localPath is metadata-controlled and must not escape the album directory.
            if (image.localPath.contains("..") || image.localPath.startsWith("/")) {
                log.warn {
                    "image_skip albumDir=$albumDir localPath=${image.localPath} reason=path_traversal_rejected"
                }
                return@mapNotNull null
            }
            val imagePath = Path(albumDir, image.localPath)
            // Canonical path check: ensure resolved path is still inside albumDir.
            // NIO.2 normalize() resolves ".." components lexically without requiring file existence.
            // startsWith() on java.nio.file.Path checks path component boundaries (safe vs string prefix).
            val nioAlbum = java.nio.file.Path.of(albumDir.toString()).normalize()
            val nioImage = java.nio.file.Path.of(imagePath.toString()).normalize()
            if (!nioImage.startsWith(nioAlbum) && nioImage != nioAlbum) {
                log.warn {
                    "image_skip albumDir=$albumDir localPath=${image.localPath} reason=outside_album_dir"
                }
                return@mapNotNull null
            }
            if (!SystemFileSystem.exists(imagePath)) {
                log.info { "image_skip albumDir=$albumDir localPath=${image.localPath} reason=file_not_found" }
                return@mapNotNull null
            }
            val bytes = runCatching {
                SystemFileSystem.source(imagePath).buffered().use { it.readByteArray() }
            }.getOrElse { e ->
                log.warn(e) { "image_read_error albumDir=$albumDir localPath=${image.localPath}" }
                return@mapNotNull null
            }
            val mimeType = image.mimeType ?: inferMimeType(image.localPath)
            FlacMetadataBlock.Picture(
                pictureType = image.pictureType,
                mimeType = mimeType,
                description = image.description ?: "",
                width = 0,
                height = 0,
                colorDepth = 0,
                colorCount = 0,
                data = ByteString(bytes),
            )
        }

    private fun inferMimeType(localPath: String): String =
        when {
            localPath.endsWith(".jpg", ignoreCase = true) ||
                localPath.endsWith(".jpeg", ignoreCase = true) -> "image/jpeg"
            localPath.endsWith(".png", ignoreCase = true) -> "image/png"
            else -> "image/jpeg"
        }

    private fun resolveDiscDirectories(albumDir: Path, discTotal: Int): List<DiscContext> {
        val subdirs = runCatching { SystemFileSystem.list(albumDir) }
            .getOrElse { emptyList() }
            .filter { SystemFileSystem.metadataOrNull(it)?.isDirectory == true }
            .filter { it.name != ".kbeatz" }
            .sortedBy { it.name }
        return if (discTotal == 1 || subdirs.isEmpty()) {
            listOf(DiscContext(albumDir))
        } else {
            subdirs.take(discTotal).map { dir -> DiscContext(dir) }
        }
    }

    private fun listFlacFilesSorted(dir: Path): List<Path> =
        runCatching { SystemFileSystem.list(dir) }
            .getOrElse { emptyList() }
            .filter { it.name.endsWith(".flac", ignoreCase = true) }
            .sortedBy { it.name }

    private fun tagFileFromMetadata(
        path: Path,
        metadata: KbeatzMetadata,
        track: KbeatzMetadata.Track,
        pictures: List<FlacMetadataBlock.Picture>,
    ) {
        var flac = FlacFile.read(path)
            .updateVorbisComment { editor -> editor.applyMetadata(metadata, track) }
        pictures.forEach { picture -> flac = flac.withPicture(picture) }
        flac.writeTo(path)
    }

    private suspend fun resolveRelease(albumDir: Path): Lookup =
        idReader.read(albumDir)?.let { idFile ->
            idReader.discogsId(idFile)?.let { discogsId ->
                metadataSource.fetchRelease(discogsId)
                    ?.let { Lookup.Found(discogsId, it) }
                    ?: Lookup.Missing("release $discogsId not found on ${metadataSource.name}")
            } ?: Lookup.Missing("no discogs_id in id file")
        } ?: Lookup.Missing("no id file found")

    private suspend fun fetchCoverArt(discogsId: String): FlacMetadataBlock.Picture? =
        metadataSource.fetchImage(discogsId, 0)?.let { img ->
            FlacMetadataBlock.Picture(
                pictureType = FlacMetadataBlock.Picture.TYPE_FRONT_COVER,
                mimeType = img.mimeType,
                description = "",
                width = 0, height = 0, colorDepth = 0, colorCount = 0,
                data = img.bytes,
            )
        }

    private fun findFlacFiles(albumDir: Path): List<Path> =
        runCatching { SystemFileSystem.list(albumDir) }
            .getOrElse { emptyList() }
            .filter { it.name.endsWith(".flac", ignoreCase = true) }

    private fun tagFile(path: Path, release: Release, picture: FlacMetadataBlock.Picture?) {
        FlacFile.read(path)
            .updateVorbisComment { editor -> editor.applyRelease(release) }
            .let { flac -> if (picture != null) flac.withPicture(picture) else flac }
            .writeTo(path)
    }
}

private data class DiscContext(val dir: Path)

private sealed class Lookup {
    data class Found(val discogsId: String, val release: Release) : Lookup()
    data class Missing(val reason: String) : Lookup()
}

private fun VorbisCommentEditor.applyMetadata(
    metadata: KbeatzMetadata,
    track: KbeatzMetadata.Track,
): VorbisCommentEditor {
    val album = metadata.album
    set(VorbisCommentFields.ALBUM, album.title)
    set(VorbisCommentFields.ALBUMARTIST, album.albumArtist)
    album.date?.let { set(VorbisCommentFields.DATE, it) }
    if (album.genres.size > 1) {
        log.debug { "multi_genre_truncation source=metadata genres=${album.genres.size} writing first only" }
    }
    album.genres.firstOrNull()?.let { set(VorbisCommentFields.GENRE, it) }
    album.label?.let { set(VorbisCommentFields.LABEL, it) }
    album.catalogNumber?.let { set(VorbisCommentFields.CATALOGNUMBER, it) }
    album.barcode?.let { set(VorbisCommentFields.BARCODE, it) }
    album.composer?.let { set(VorbisCommentFields.COMPOSER, it) }
    album.conductor?.let { set(VorbisCommentFields.CONDUCTOR, it) }
    album.ensemble?.let { set(VorbisCommentFields.ENSEMBLE, it) }
    set(VorbisCommentFields.DISCNUMBER, track.discNumber.toString())
    set(VorbisCommentFields.DISCTOTAL, album.discTotal.toString())
    set(VorbisCommentFields.TRACKNUMBER, track.trackNumber.toString())
    set(VorbisCommentFields.TRACKTOTAL, track.trackTotal.toString())
    set(VorbisCommentFields.TITLE, track.title)
    track.artist?.let { set(VorbisCommentFields.ARTIST, it) }
        ?: set(VorbisCommentFields.ARTIST, album.albumArtist)
    track.discSubtitle?.let { set(VorbisCommentFields.DISCSUBTITLE, it) }
    if (metadata.source == "discogs") {
        set(VorbisCommentFields.DISCOGS_ID, metadata.sourceId)
    }
    return this
}

private fun VorbisCommentEditor.applyRelease(release: Release): VorbisCommentEditor {
    set(VorbisCommentFields.ALBUM, release.title)
    release.artists.firstOrNull()?.let { set(VorbisCommentFields.ALBUMARTIST, it.name) }
    release.resolvedYear()?.let { set(VorbisCommentFields.DATE, it) }
    if (release.genres.size > 1) {
        log.debug { "multi_genre_truncation source=discogs genres=${release.genres.size} writing first only" }
    }
    release.genres.firstOrNull()?.let { set(VorbisCommentFields.GENRE, it) }
    release.labels.firstOrNull()?.let {
        set(VorbisCommentFields.LABEL, it.name)
        set(VorbisCommentFields.CATALOGNUMBER, it.catno)
    }
    set(VorbisCommentFields.DISCOGS_ID, release.sourceId)
    release.resourceUrl?.let { set(VorbisCommentFields.DISCOGS_RELEASE_URL, it) }
    release.barcode?.let { set(VorbisCommentFields.BARCODE, it) }
    release.extraArtists
        .firstOrNull { it.role == ROLE_COMPOSED_BY }
        ?.let { set(VorbisCommentFields.COMPOSER, it.name) }
    release.extraArtists
        .firstOrNull { it.role == ROLE_CONDUCTOR }
        ?.let { set(VorbisCommentFields.CONDUCTOR, it.name) }
    release.extraArtists
        .firstOrNull { it.role == ROLE_ORCHESTRA }
        ?.let { set(VorbisCommentFields.ENSEMBLE, it.name) }
    return this
}

private fun Release.resolvedYear(): String? = released?.year?.toString() ?: year?.toString()
