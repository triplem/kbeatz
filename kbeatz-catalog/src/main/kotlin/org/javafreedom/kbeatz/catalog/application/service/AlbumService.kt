package org.javafreedom.kbeatz.catalog.application.service

import kotlin.uuid.Uuid
import org.javafreedom.kbeatz.catalog.domain.model.Album
import org.javafreedom.kbeatz.catalog.domain.model.Track
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumRepository
import org.javafreedom.kbeatz.catalog.domain.repository.TrackRepository
import org.javafreedom.kbeatz.common.ResourceNotFoundException

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

    suspend fun listAlbums(page: Int, size: Int): Pair<List<Album>, Long> {
        val albums = repository.findAll(page, size)
        val total = repository.count()
        return albums to total
    }
}
