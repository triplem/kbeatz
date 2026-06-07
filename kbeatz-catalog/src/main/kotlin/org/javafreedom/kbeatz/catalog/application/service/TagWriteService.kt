package org.javafreedom.kbeatz.catalog.application.service

import io.github.oshai.kotlinlogging.KotlinLogging
import java.nio.file.Files
import java.nio.file.Path
import kotlin.uuid.Uuid
import kotlinx.io.files.Path as KtPath
import org.javafreedom.kbeatz.catalog.domain.model.Album
import org.javafreedom.kbeatz.catalog.domain.model.Track
import org.javafreedom.kbeatz.catalog.domain.model.WRITE_LOCK_FILENAME
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumRepository
import org.javafreedom.kbeatz.catalog.domain.repository.TrackRepository
import org.javafreedom.kbeatz.common.ResourceNotFoundException
import org.javafreedom.kbeatz.tagger.codec.flac.FlacFile

private val log = KotlinLogging.logger {}

/** Allowed Vorbis Comment fields for album-level writes. Field names are uppercase. */
val ALBUM_LEVEL_FIELDS: Set<String> = setOf(
    "ALBUM", "ALBUMARTIST", "DATE", "GENRE", "LABEL", "CATALOGNUMBER",
    "COMPOSER", "CONDUCTOR", "ENSEMBLE",
)

/** Allowed Vorbis Comment fields for track-level writes. Field names are uppercase. */
val TRACK_LEVEL_FIELDS: Set<String> = setOf("TITLE", "TRACKNUMBER", "ARTIST")

/**
 * Writes individual Vorbis Comment tag fields to FLAC files on disk.
 *
 * ## Album-level write sequence
 * 1. Look up album via [albumRepository] — throws [ResourceNotFoundException] if absent.
 * 2. Validate [field] is in [ALBUM_LEVEL_FIELDS] — throws [IllegalArgumentException] if invalid.
 * 3. Validate album directory is within [libraryRoot] (path traversal guard).
 * 4. Write `.kbeatz-write.lock` to album directory listing all target FLAC paths.
 * 5. For each FLAC file: [FlacFile.writeTo] performs temp-file → atomic rename.
 * 6. Delete `.kbeatz-write.lock`.
 * 7. Persist updated [Album] record via [albumRepository].
 *
 * ## Track-level write sequence
 * Same steps but targets a single FLAC file; no write-lock manifest is written
 * (single atomic op is safe without a manifest).
 *
 * ## Failure handling
 * If any file write fails, the lock file is left in place and the exception is rethrown.
 * [LibraryScanService.repairOnStartup] detects stale lock files and re-indexes affected directories.
 *
 * No Ktor types are present in this class — it is a pure application-layer service.
 */
class TagWriteService(
    private val albumRepository: AlbumRepository,
    private val trackRepository: TrackRepository,
    private val libraryRoot: Path,
) {

    /**
     * Writes a single [field]=[value] tag to all FLAC files in the album directory.
     *
     * @param albumId Target album UUID.
     * @param field Vorbis Comment field name (case-insensitive; normalised to uppercase).
     * @param value New field value.
     * @return Updated [Album] reflecting the change.
     * @throws ResourceNotFoundException if the album is not found.
     * @throws IllegalArgumentException if [field] is not in [ALBUM_LEVEL_FIELDS].
     * @throws SecurityException if the album directory is outside [libraryRoot].
     */
    suspend fun writeAlbumTags(albumId: Uuid, field: String, value: String): Album {
        val normalised = field.uppercase()
        require(normalised in ALBUM_LEVEL_FIELDS) {
            "Unknown album-level tag field: '$field'. Allowed: ${ALBUM_LEVEL_FIELDS.sorted()}"
        }

        val album = albumRepository.findById(albumId)
            ?: throw ResourceNotFoundException("Album", albumId.toString())

        val albumDir = Path.of(album.directoryPath)
        validatePath(albumDir)

        val flacFiles = findFlacFiles(albumDir)
        writeLockFile(albumDir, flacFiles)

        writeTagToFiles(flacFiles, normalised, value, albumId)

        deleteLockFile(albumDir)

        val updatedAlbum = album.applyAlbumField(normalised, value)
        albumRepository.save(updatedAlbum)
        log.info { "Album tag write complete albumId=$albumId field=$normalised" }
        return updatedAlbum
    }

    /**
     * Writes a single [field]=[value] tag to the FLAC file for a specific track.
     *
     * @param albumId Parent album UUID.
     * @param trackId Target track UUID.
     * @param field Vorbis Comment field name (case-insensitive; normalised to uppercase).
     * @param value New field value.
     * @return Updated [Track] reflecting the change.
     * @throws ResourceNotFoundException if the album or track is not found.
     * @throws IllegalArgumentException if [field] is not in [TRACK_LEVEL_FIELDS].
     * @throws SecurityException if the album directory is outside [libraryRoot].
     */
    suspend fun writeTrackTags(albumId: Uuid, trackId: Uuid, field: String, value: String): Track {
        val normalised = field.uppercase()
        require(normalised in TRACK_LEVEL_FIELDS) {
            "Unknown track-level tag field: '$field'. Allowed: ${TRACK_LEVEL_FIELDS.sorted()}"
        }

        val album = albumRepository.findById(albumId)
            ?: throw ResourceNotFoundException("Album", albumId.toString())

        val tracks = trackRepository.findByAlbumId(albumId)
        val track = tracks.firstOrNull { it.id == trackId }
            ?: throw ResourceNotFoundException("Track", trackId.toString())

        val albumDir = Path.of(album.directoryPath)
        validatePath(albumDir)

        val flacPath = albumDir.resolve(track.path)
        writeTagToSingleFile(flacPath, normalised, value, trackId)

        // Track-level: no lock manifest needed for a single atomic write.
        val updatedTrack = track.applyTrackField(normalised, value)
        trackRepository.update(updatedTrack)
        log.info { "Track tag write complete albumId=$albumId trackId=$trackId field=$normalised" }
        return updatedTrack
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

    private fun writeLockFile(albumDir: Path, flacFiles: List<Path>) {
        if (flacFiles.isEmpty()) return
        Files.createDirectories(albumDir)
        val manifest = flacFiles.joinToString("\n") { it.toString() }
        Files.writeString(albumDir.resolve(WRITE_LOCK_FILENAME), manifest)
        log.debug { "Write-lock manifest created in $albumDir (${flacFiles.size} files)" }
    }

    private fun deleteLockFile(albumDir: Path) {
        Files.deleteIfExists(albumDir.resolve(WRITE_LOCK_FILENAME))
        log.debug { "Write-lock manifest removed from $albumDir" }
    }

    private fun writeTagToFiles(
        files: List<Path>,
        field: String,
        value: String,
        albumId: Uuid,
    ) {
        files.forEach { flacPath ->
            FlacFile.read(KtPath(flacPath.toString()))
                .updateVorbisComment { editor -> editor.set(field, value) }
                .writeTo(KtPath(flacPath.toString()))
            log.debug { "Tag written albumId=$albumId field=$field path=$flacPath" }
        }
    }

    private fun writeTagToSingleFile(flacPath: Path, field: String, value: String, trackId: Uuid) {
        FlacFile.read(KtPath(flacPath.toString()))
            .updateVorbisComment { editor -> editor.set(field, value) }
            .writeTo(KtPath(flacPath.toString()))
        log.debug { "Tag written trackId=$trackId field=$field path=$flacPath" }
    }
}

private fun Album.applyAlbumField(field: String, value: String): Album = when (field) {
    "ALBUM" -> copy(album = value)
    "ALBUMARTIST" -> copy(albumArtist = value)
    "DATE" -> copy(date = value)
    "GENRE" -> copy(genre = value)
    "LABEL" -> copy(label = value)
    "CATALOGNUMBER" -> copy(catalogNumber = value)
    "COMPOSER" -> copy(composer = value)
    "CONDUCTOR" -> copy(conductor = value)
    "ENSEMBLE" -> copy(ensemble = value)
    else -> this
}

private fun Track.applyTrackField(field: String, value: String): Track = when (field) {
    "TITLE" -> copy(title = value)
    "TRACKNUMBER" -> copy(trackNumber = value)
    "ARTIST" -> copy(artist = value)
    else -> this
}
