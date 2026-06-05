package org.javafreedom.kbeatz.catalog.domain.repository

import kotlin.uuid.Uuid
import org.javafreedom.kbeatz.catalog.domain.model.Album

interface AlbumRepository {
    suspend fun findById(id: Uuid): Album?
    suspend fun findAll(page: Int, size: Int): List<Album>
    suspend fun count(): Long
    suspend fun save(album: Album): Album
    suspend fun saveAll(albums: List<Album>)
}
