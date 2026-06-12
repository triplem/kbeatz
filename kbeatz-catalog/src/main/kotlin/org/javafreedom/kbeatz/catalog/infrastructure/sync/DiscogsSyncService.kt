package org.javafreedom.kbeatz.catalog.infrastructure.sync

import io.github.oshai.kotlinlogging.KotlinLogging
import java.nio.file.Files
import java.nio.file.Path
import kotlin.uuid.Uuid
import kotlinx.io.files.Path as KtPath
import org.javafreedom.kbeatz.catalog.domain.model.Album
import org.javafreedom.kbeatz.catalog.domain.model.SyncResult
import org.javafreedom.kbeatz.catalog.domain.model.WRITE_LOCK_FILENAME
import org.javafreedom.kbeatz.catalog.domain.port.SyncProvider
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumRepository
import org.javafreedom.kbeatz.common.BusinessValidationException
import org.javafreedom.kbeatz.common.ImageQuotaExhaustedException
import org.javafreedom.kbeatz.common.ResourceNotFoundException
import org.javafreedom.kbeatz.sources.MetadataSource
import org.javafreedom.kbeatz.sources.Release
import org.javafreedom.kbeatz.tagger.codec.flac.FlacFile
import org.javafreedom.kbeatz.tagger.codec.flac.VorbisCommentFields

private val log = KotlinLogging.logger {}
private const val ROLE_COMPOSED_BY = "Composed By"
private const val ROLE_CONDUCTOR = "Conductor"
private const val ROLE_ORCHESTRA = "Orchestra"

/**
 * Orchestrates a full Discogs metadata sync for a single album.
 *
 * Implements [SyncProvider] so it can be registered as the active sync provider at wiring time.
 * A future MusicBrainz or other provider would be a separate implementation of [SyncProvider].
 *
 * ## Sync sequence
 * 1. Load album from repository — throws [ResourceNotFoundException] if not found.
 * 2. Validate `discogsId` is present — throws [BusinessValidationException] if absent.
 * 3. Fetch Discogs release via [metadataSource] (rate-limited, returns null -> warning, no-op).
 * 4. Write `.kbeatz-write.lock` to album directory.
 * 5. Write tags to all FLAC files atomically.
 * 6. Optionally: download + embed cover art via [imageService] (quota warning on exhaustion).
 * 7. Delete lock file.
 * 8. Update H2 album record via [albumRepository].
 *
 * ## Write-lock safety
 * The `.kbeatz-write.lock` file is created before any FLAC write and deleted on success.
 * If the JVM is killed mid-write, the lock file is detected by [LibraryScanService.repairOnStartup].
 *
 * @param albumRepository Repository for album read/write.
 * @param metadataSource Discogs API adapter (rate-limited).
 * @param imageService Cover art downloader (optional; null disables cover art).
 * @param libraryRoot Library root for path traversal validation.
 */
class DiscogsSyncService(
    private val albumRepository: AlbumRepository,
    private val metadataSource: MetadataSource,
    private val imageService: DiscogsImageService?,
    private val libraryRoot: Path,
) : SyncProvider {

    override val name: String = "discogs"

    /**
     * Syncs a single album from Discogs.
     *
     * @param albumId The album UUID to sync.
     * @param downloadImages When true, attempts cover art download after tag writes.
     * @return [SyncResult] describing what was written and any non-fatal warnings.
     * @throws ResourceNotFoundException when the album is not found.
     * @throws BusinessValidationException when the album has no `discogsId`.
     */
    override suspend fun sync(albumId: Uuid, downloadImages: Boolean): SyncResult {
        val album = albumRepository.findById(albumId)
            ?: throw ResourceNotFoundException("Album", albumId.toString())

        val discogsId = album.discogsId
            ?: throw BusinessValidationException("Album '${albumId}' has no Discogs ID set - cannot sync")

        val release = metadataSource.fetchRelease(discogsId)
        if (release == null) {
            log.warn { "discogs_release_not_found albumId=$albumId discogsId=$discogsId" }
            return SyncResult(
                fieldsWritten = emptyList(),
                warnings = listOf("Discogs release $discogsId not found"),
                updatedAlbum = album,
            )
        }

        val albumDir = Path.of(album.directoryPath)
        validatePath(albumDir)

        val tags = release.toVorbisTagMap()
        val flacFiles = findFlacFiles(albumDir)

        writeLockFile(albumDir)
        writeTagsToFlacFiles(flacFiles, tags)

        val warnings = mutableListOf<String>()
        downloadCoverArtIfRequested(albumId, discogsId, albumDir, downloadImages, warnings)

        deleteLockFile(albumDir)

        val updatedAlbum = buildUpdatedAlbum(album, tags, discogsId)
        albumRepository.save(updatedAlbum)

        log.info { "Sync complete for album $albumId: ${tags.size} tags written, ${warnings.size} warnings" }
        return SyncResult(
            fieldsWritten = tags.keys.toList().sorted(),
            warnings = warnings,
            updatedAlbum = updatedAlbum,
        )
    }

    private suspend fun downloadCoverArtIfRequested(
        albumId: Uuid,
        discogsId: String,
        albumDir: Path,
        downloadImages: Boolean,
        warnings: MutableList<String>,
    ) {
        val service = imageService ?: return
        try {
            service.downloadAndWrite(discogsId, albumDir, downloadImages)
        } catch (ex: ImageQuotaExhaustedException) {
            log.warn { "discogs_image_quota_exhausted albumId=$albumId discogsId=$discogsId" }
            warnings += "Image quota exhausted. Resets at ${ex.resetAt}"
        }
    }

    private fun validatePath(albumDir: Path) {
        val resolved = if (Files.exists(albumDir)) albumDir.toRealPath() else albumDir.normalize()
        if (!resolved.startsWith(libraryRoot.normalize())) {
            throw SecurityException("Album directory is outside the library root: $albumDir")
        }
    }

    private fun findFlacFiles(albumDir: Path): List<Path> =
        if (Files.isDirectory(albumDir)) {
            Files.list(albumDir).use { stream ->
                stream
                    .filter { it.fileName.toString().endsWith(".flac", ignoreCase = true) }
                    .sorted()
                    .toList()
            }
        } else {
            emptyList()
        }

    private fun writeLockFile(albumDir: Path) {
        Files.createDirectories(albumDir)
        Files.writeString(albumDir.resolve(WRITE_LOCK_FILENAME), "")
        log.debug { "Lock file created in $albumDir" }
    }

    private fun deleteLockFile(albumDir: Path) {
        Files.deleteIfExists(albumDir.resolve(WRITE_LOCK_FILENAME))
        log.debug { "Lock file removed from $albumDir" }
    }

    private fun writeTagsToFlacFiles(files: List<Path>, tags: Map<String, String>) {
        files.forEach { flacPath ->
            FlacFile.read(KtPath(flacPath.toString()))
                .updateVorbisComment { editor -> tags.forEach { (k, v) -> editor.set(k, v) }; editor }
                .writeTo(KtPath(flacPath.toString()))
            log.debug { "Tags written to $flacPath" }
        }
    }

    private fun buildUpdatedAlbum(original: Album, tags: Map<String, String>, discogsId: String): Album =
        original.copy(
            albumArtist = tags[VorbisCommentFields.ALBUMARTIST] ?: original.albumArtist,
            album = tags[VorbisCommentFields.ALBUM] ?: original.album,
            date = tags[VorbisCommentFields.DATE] ?: original.date,
            genre = tags[VorbisCommentFields.GENRE] ?: original.genre,
            label = tags[VorbisCommentFields.LABEL] ?: original.label,
            catalogNumber = tags[VorbisCommentFields.CATALOGNUMBER] ?: original.catalogNumber,
            composer = tags[VorbisCommentFields.COMPOSER] ?: original.composer,
            conductor = tags[VorbisCommentFields.CONDUCTOR] ?: original.conductor,
            ensemble = tags[VorbisCommentFields.ENSEMBLE] ?: original.ensemble,
            discogsId = discogsId,
        )
}

/** Maps a domain [Release] to a flat Vorbis Comment tag map for writing to FLAC files. */
private fun Release.toVorbisTagMap(): Map<String, String> {
    val tags = mutableMapOf<String, String>()
    tags[VorbisCommentFields.ALBUM] = title
    artists.firstOrNull()?.name?.let { tags[VorbisCommentFields.ALBUMARTIST] = it }
    resolvedYear()?.let { tags[VorbisCommentFields.DATE] = it }
    genres.firstOrNull()?.let { tags[VorbisCommentFields.GENRE] = it }
    labels.firstOrNull()?.let {
        tags[VorbisCommentFields.LABEL] = it.name
        tags[VorbisCommentFields.CATALOGNUMBER] = it.catno
    }
    tags[VorbisCommentFields.DISCOGS_ID] = sourceId
    resourceUrl?.let { tags[VorbisCommentFields.DISCOGS_RELEASE_URL] = it }
    barcode?.let { tags[VorbisCommentFields.BARCODE] = it }
    extraArtists.firstOrNull { it.role == ROLE_COMPOSED_BY }?.let { tags[VorbisCommentFields.COMPOSER] = it.name }
    extraArtists.firstOrNull { it.role == ROLE_CONDUCTOR }?.let { tags[VorbisCommentFields.CONDUCTOR] = it.name }
    extraArtists.firstOrNull { it.role == ROLE_ORCHESTRA }?.let { tags[VorbisCommentFields.ENSEMBLE] = it.name }
    return tags.toMap()
}

private fun Release.resolvedYear(): String? = released?.year?.toString() ?: year?.toString()
