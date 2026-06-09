package org.javafreedom.kbeatz.catalog.application.service

import kotlin.uuid.Uuid
import org.javafreedom.kbeatz.catalog.domain.model.Album
import org.javafreedom.kbeatz.catalog.domain.model.Track
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumRepository
import org.javafreedom.kbeatz.catalog.domain.repository.TrackRepository
import org.javafreedom.kbeatz.common.ResourceNotFoundException

/**
 * Application-layer service for album and track reads.
 *
 * ## No in-memory cache (ADR-007 / issue #371)
 *
 * Every [listAlbums] call queries H2 directly. There is no in-memory album list.
 * H2 in PostgreSQL-compat mode with an indexed table returns paginated results
 * well under 50 ms at 10,000 albums, so caching complexity is not justified.
 * If profiling ever shows a bottleneck, add a cache at that point - do not add
 * one speculatively.
 *
 * The absence of a cache means:
 * - No invalidation logic needed after tag writes or Discogs sync.
 * - GET /api/v1/albums always reflects the current H2 state.
 * - No risk of stale data after [LibraryScanService] completes.
 */
class AlbumService(
    private val repository: AlbumRepository,
    private val trackRepository: TrackRepository,
) {

    suspend fun getAlbum(id: Uuid): Album =
        repository.findById(id) ?: throw ResourceNotFoundException("Album", id.toString())

    /** Returns the album and its ordered tracks. Throws [ResourceNotFoundException] if not found. */
    suspend fun getAlbumWithTracks(id: Uuid): Pair<Album, List<Track>> {
        val album = repository.findById(id) ?: throw ResourceNotFoundException("Album", id.toString())
        val tracks = trackRepository.findByAlbumId(id)
        return album to tracks
    }

    suspend fun listAlbums(page: Int, size: Int): Pair<List<Album>, Long> =
        repository.findAllWithCount(page, size)
}
