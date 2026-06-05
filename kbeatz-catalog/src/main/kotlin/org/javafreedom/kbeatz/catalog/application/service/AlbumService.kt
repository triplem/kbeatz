package org.javafreedom.kbeatz.catalog.application.service

import kotlin.uuid.Uuid
import org.javafreedom.kbeatz.catalog.domain.model.Album
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumRepository
import org.javafreedom.kbeatz.common.ResourceNotFoundException

class AlbumService(private val repository: AlbumRepository) {

    suspend fun getAlbum(id: Uuid): Album =
        repository.findById(id) ?: throw ResourceNotFoundException("Album", id.toString())

    suspend fun listAlbums(page: Int, size: Int): Pair<List<Album>, Long> {
        val albums = repository.findAll(page, size)
        val total = repository.count()
        return albums to total
    }
}
