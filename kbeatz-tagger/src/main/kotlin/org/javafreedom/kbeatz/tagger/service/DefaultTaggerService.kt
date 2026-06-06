package org.javafreedom.kbeatz.tagger.service

import kotlinx.io.files.Path
import kotlinx.io.files.SystemFileSystem
import org.javafreedom.kbeatz.sources.MetadataSource
import org.javafreedom.kbeatz.sources.Release
import org.javafreedom.kbeatz.tagger.codec.flac.FlacFile
import org.javafreedom.kbeatz.tagger.codec.flac.VorbisCommentEditor
import org.javafreedom.kbeatz.tagger.codec.flac.VorbisCommentFields
import org.javafreedom.kbeatz.tagger.idfile.IdFileReader
import org.javafreedom.kbeatz.tagger.idfile.SourceConfig

class DefaultTaggerService(
    private val idReader: IdFileReader = IdFileReader(SourceConfig()),
    private val metadataSource: MetadataSource,
) : TaggerService {

    override suspend fun tagAlbum(albumDir: Path, downloadImages: Boolean): TagResult =
        when (val lookup = resolveRelease(albumDir)) {
            is Lookup.Missing -> TagResult.Skipped(albumDir, lookup.reason)
            is Lookup.Found -> runCatching {
                val files = findFlacFiles(albumDir)
                files.forEach { path -> tagFile(path, lookup.release) }
                TagResult.Tagged(albumDir, lookup.discogsId, files.size)
            }.getOrElse { e -> TagResult.Failed(albumDir, e) }
        }

    private suspend fun resolveRelease(albumDir: Path): Lookup =
        idReader.read(albumDir)?.let { idFile ->
            idReader.discogsId(idFile)?.let { discogsId ->
                metadataSource.fetchRelease(discogsId)
                    ?.let { Lookup.Found(discogsId, it) }
                    ?: Lookup.Missing("release $discogsId not found on ${metadataSource.name}")
            } ?: Lookup.Missing("no discogs_id in id file")
        } ?: Lookup.Missing("no id file found")

    private fun findFlacFiles(albumDir: Path): List<Path> =
        runCatching { SystemFileSystem.list(albumDir) }
            .getOrElse { emptyList() }
            .filter { it.name.endsWith(".flac", ignoreCase = true) }

    private fun tagFile(path: Path, release: Release) {
        FlacFile.read(path)
            .updateVorbisComment { editor -> editor.applyRelease(release) }
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
        .firstOrNull { it.role == "Composed By" }
        ?.let { set(VorbisCommentFields.COMPOSER, it.name) }
    release.extraArtists
        .firstOrNull { it.role == "Conductor" }
        ?.let { set(VorbisCommentFields.CONDUCTOR, it.name) }
    release.extraArtists
        .firstOrNull { it.role == "Orchestra" }
        ?.let { set(VorbisCommentFields.ENSEMBLE, it.name) }
    return this
}

private fun Release.resolvedYear(): String? = released?.year?.toString() ?: year?.toString()
