package org.javafreedom.kbeatz.tagger.service

import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.io.files.Path
import kotlinx.io.files.SystemFileSystem
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

private sealed class Lookup {
    data class Found(val discogsId: String, val release: Release) : Lookup()
    data class Missing(val reason: String) : Lookup()
}

private fun VorbisCommentEditor.applyRelease(release: Release): VorbisCommentEditor {
    set(VorbisCommentFields.ALBUM, release.title)
    release.artists.firstOrNull()?.let { set(VorbisCommentFields.ALBUMARTIST, it.name) }
    release.resolvedYear()?.let { set(VorbisCommentFields.DATE, it) }
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
