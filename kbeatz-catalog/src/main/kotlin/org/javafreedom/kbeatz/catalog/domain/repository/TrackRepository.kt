package org.javafreedom.kbeatz.catalog.domain.repository

import kotlin.uuid.Uuid
import org.javafreedom.kbeatz.catalog.domain.model.Track

interface TrackRepository {
    suspend fun findByAlbumId(albumId: Uuid): List<Track>
    suspend fun saveAll(tracks: List<Track>)
    suspend fun update(track: Track)
    suspend fun deleteByAlbumId(albumId: Uuid)
}
