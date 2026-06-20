package org.javafreedom.kbeatz.catalog.application.service

import io.github.oshai.kotlinlogging.KotlinLogging
import java.nio.file.Path
import java.util.concurrent.ConcurrentHashMap
import kotlin.uuid.Uuid
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.javafreedom.kbeatz.catalog.domain.model.Album
import org.javafreedom.kbeatz.catalog.domain.model.Track
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumRepository
import org.javafreedom.kbeatz.catalog.domain.repository.TrackRepository
import org.javafreedom.kbeatz.catalog.infrastructure.tag.FlacTagWriter
import org.javafreedom.kbeatz.common.BusinessValidationException
import org.javafreedom.kbeatz.common.ResourceNotFoundException
import org.javafreedom.kbeatz.tagger.codec.flac.MAX_TAG_VALUE_LENGTH

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
 * ## Concurrency model (issue #385)
 *
 * Two simultaneous HTTP PATCH requests for the same album are serialised using a
 * per-album [Mutex] from [albumLocks]. The Mutex is acquired before any FLAC file
 * is touched and released after the repository save completes. A second PATCH for
 * the same album waits until the first write (including lock-file lifecycle) finishes.
 *
 * The `.kbeatz-write.lock` file is a cross-process guard for catalog-vs-CLI conflicts:
 * if a lock file is already present when this service tries to write, it throws
 * [ConflictException] so the HTTP handler can return 409. The in-memory Mutex and the
 * file-based lock file are complementary: acquire the Mutex first, then check the file.
 *
 * ## Album-level write sequence
 * 1. Acquire in-memory [Mutex] for the [albumId] (serialises concurrent HTTP requests).
 * 2. Look up album via [albumRepository] - throws [ResourceNotFoundException] if absent.
 * 3. Validate [field] is in [ALBUM_LEVEL_FIELDS] - throws [IllegalArgumentException] if invalid.
 * 4. Validate album directory is within [libraryRoot] (path traversal guard).
 * 5. Check for existing `.kbeatz-write.lock` - throw [ConflictException] if present (CLI conflict).
 * 6. Write `.kbeatz-write.lock` to album directory listing all target FLAC paths.
 * 7. For each FLAC file: [FlacFile.writeTo] performs temp-file → atomic rename.
 * 8. Delete `.kbeatz-write.lock`.
 * 9. Persist updated [Album] record via [albumRepository].
 *
 * ## Track-level write sequence
 * Same steps but targets a single FLAC file; no write-lock manifest is written
 * (single atomic op is safe without a manifest).
 *
 * ## Failure handling
 * The lock file is always deleted in a `finally` block, even if the write fails. The exception
 * is rethrown so the caller receives the original error.
 *
 * No Ktor types are present in this class; it is a pure application-layer service.
 */
class TagWriteService(
    private val albumRepository: AlbumRepository,
    private val trackRepository: TrackRepository,
    private val libraryRoot: Path,
    private val flacTagWriter: FlacTagWriter = FlacTagWriter(libraryRoot),
) {
    /**
     * Per-album in-memory mutexes that serialise concurrent HTTP PATCH requests.
     *
     * One [Mutex] is created per album UUID on first access and retained for the lifetime
     * of the service. At 10,000 albums this is negligible memory (one object per album).
     * Entries are never evicted; the map is only as large as the number of distinct albums
     * that have received at least one write since the service started.
     */
    private val albumLocks = ConcurrentHashMap<Uuid, Mutex>()

    /**
     * Writes a single [field]=[value] tag to all FLAC files in the album directory and any
     * merged directories stored in [Album.mergedDirectories].
     *
     * For deduplicated albums that span multiple sibling directories (e.g. `jazz/lossless/`
     * and `jazz/backup/` merged by LibraryWalker), tags are written to FLAC files in ALL
     * directories, not just the primary [Album.directoryPath]. This ensures that the files
     * in every merged directory remain in sync after a PATCH request (issue #666).
     *
     * The write-lock file is created only in the primary [Album.directoryPath]. Merged
     * directories receive no lock file because they are always written within the same
     * in-memory [Mutex]-serialised critical section as the primary directory write.
     *
     * If a merged directory no longer exists on disk (e.g. it was removed after the last
     * scan), that directory is skipped and a WARN is logged. The primary directory write
     * is unaffected.
     *
     * ## Partial failure contract
     *
     * This method does NOT guarantee atomicity across directories. Writes are applied
     * sequentially: primary directory first, then each merged directory in order.
     *
     * If writing to a merged directory fails (e.g. permission denied, disk full), the
     * primary directory writes are NOT rolled back. The caller receives the exception,
     * and the merged directory will retain stale tag values until the next successful
     * write or a full library rescan corrects the inconsistency. This is intentional:
     * the current design prioritises simplicity over cross-directory atomicity.
     *
     * Operators can identify partial failures via structured error log entries emitted
     * during the merged directory write phase, which include the failed directory path
     * and how many merged directories completed before the failure.
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
        requireTagValueLength(field, value)
        val normalised = field.uppercase()
        require(normalised in ALBUM_LEVEL_FIELDS) {
            "Unknown album-level tag field: '$field'. Allowed: ${ALBUM_LEVEL_FIELDS.sorted()}"
        }

        val mutex = albumLocks.getOrPut(albumId) { Mutex() }
        return mutex.withLock {
            val album = albumRepository.findById(albumId)
                ?: throw ResourceNotFoundException("Album", albumId.toString())

            // The single FLAC tag-write path (story #817): atomic per-file writes across the
            // primary and any merged directories, under one .kbeatz-write.lock manifest. Path
            // traversal and cross-writer lock conflicts are enforced inside the writer.
            flacTagWriter.writeAlbumFields(
                albumId = albumId,
                primaryDir = Path.of(album.directoryPath),
                mergedDirs = album.mergedDirectories,
                fields = mapOf(normalised to value),
            )

            val updatedAlbum = album.applyAlbumField(normalised, value)
            albumRepository.save(updatedAlbum)
            log.info { "album_tag_write_complete albumId=$albumId field=$normalised" }
            updatedAlbum
        }
    }

    /**
     * Writes multiple album-level tag fields in a single Mutex acquisition, then writes
     * multiple track-level fields sequentially.
     *
     * Album-level fields are applied first (all within one lock-file lifecycle):
     * 1. Acquire in-memory [Mutex] for [albumId].
     * 2. Check and create `.kbeatz-write.lock`.
     * 3. Write each field in [albumFields] to all FLAC files in the album directory.
     * 4. Delete `.kbeatz-write.lock`.
     * 5. Persist the updated [Album].
     *
     * Track-level fields are then applied in order via [writeTrackTags].
     *
     * @param albumId Target album UUID.
     * @param albumFields List of (field, value) pairs for album-level writes. May be empty.
     * @param trackFields List of (trackId, field, value) triples for track-level writes. May be empty.
     * @return Updated [Album] reflecting all album-level changes (track changes do not affect the Album model).
     * @throws ResourceNotFoundException if the album or any referenced track is not found.
     * @throws IllegalArgumentException if any field is not in the allowed set.
     * @throws SecurityException if the album directory is outside [libraryRoot].
     */
    suspend fun writeBulkTags(
        albumId: Uuid,
        albumFields: List<Pair<String, String>>,
        trackFields: List<Triple<Uuid, String, String>>,
    ): Album {
        albumFields.forEach { (field, value) -> requireTagValueLength(field, value) }
        trackFields.forEach { (_, field, value) -> requireTagValueLength(field, value) }

        val normalisedAlbumFields = albumFields.map { (field, value) ->
            val n = field.uppercase()
            require(n in ALBUM_LEVEL_FIELDS) {
                "Unknown album-level tag field: '$field'. Allowed: ${ALBUM_LEVEL_FIELDS.sorted()}"
            }
            n to value
        }

        trackFields.forEach { (_, field, _) ->
            val n = field.uppercase()
            require(n in TRACK_LEVEL_FIELDS) {
                "Unknown track-level tag field: '$field'. Allowed: ${TRACK_LEVEL_FIELDS.sorted()}"
            }
        }

        val mutex = albumLocks.getOrPut(albumId) { Mutex() }
        val finalAlbum: Album = mutex.withLock {
            val album = albumRepository.findById(albumId)
                ?: throw ResourceNotFoundException("Album", albumId.toString())

            if (normalisedAlbumFields.isEmpty()) {
                album
            } else {
                // All album-level fields are written in a single .kbeatz-write.lock lifecycle via
                // the shared FLAC tag-write path (story #817). Later entries for the same field win,
                // matching the previous sequential write semantics.
                flacTagWriter.writeAlbumFields(
                    albumId = albumId,
                    primaryDir = Path.of(album.directoryPath),
                    mergedDirs = album.mergedDirectories,
                    fields = normalisedAlbumFields.toMap(),
                )

                var updatedAlbum = album
                normalisedAlbumFields.forEach { (normalised, value) ->
                    updatedAlbum = updatedAlbum.applyAlbumField(normalised, value)
                }
                albumRepository.save(updatedAlbum)
                log.info {
                    "bulk_album_tag_write_complete albumId=$albumId fieldCount=${normalisedAlbumFields.size}"
                }
                updatedAlbum
            }
        }

        @Suppress("TooGenericExceptionCaught") // log-and-rethrow: all writeTrackTags errors need structured log
        trackFields.forEach { (trackId, field, value) ->
            try {
                writeTrackTags(albumId, trackId, field, value)
            } catch (ex: Exception) {
                log.warn(ex) {
                    "bulk_track_tag_write_failed albumId=$albumId trackId=$trackId field=$field"
                }
                throw ex
            }
        }

        return finalAlbum
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
        requireTagValueLength(field, value)
        val normalised = field.uppercase()
        require(normalised in TRACK_LEVEL_FIELDS) {
            "Unknown track-level tag field: '$field'. Allowed: ${TRACK_LEVEL_FIELDS.sorted()}"
        }

        val album = albumRepository.findById(albumId)
            ?: throw ResourceNotFoundException("Album", albumId.toString())

        val tracks = trackRepository.findByAlbumId(albumId)
        val track = tracks.firstOrNull { it.id == trackId }
            ?: throw ResourceNotFoundException("Track", trackId.toString())

        val flacPath = Path.of(album.directoryPath).resolve(track.path)
        // Track-level: a single atomic write via the shared FLAC tag-write path; no lock manifest
        // is needed for one file (story #817).
        flacTagWriter.writeSingleFile(flacPath, mapOf(normalised to value))

        val updatedTrack = track.applyTrackField(normalised, value)
        trackRepository.update(updatedTrack)
        log.info { "Track tag write complete albumId=$albumId trackId=$trackId field=$normalised" }
        return updatedTrack
    }

    private fun requireTagValueLength(field: String, value: String) {
        if (value.length > MAX_TAG_VALUE_LENGTH) {
            throw BusinessValidationException(
                "Tag value for '$field' exceeds the maximum allowed length of $MAX_TAG_VALUE_LENGTH characters " +
                    "(got ${value.length} characters)"
            )
        }
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
