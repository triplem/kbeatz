package org.javafreedom.kbeatz.catalog.domain.repository

import kotlin.uuid.Uuid
import org.javafreedom.kbeatz.catalog.domain.model.Album

interface AlbumRepository {
    suspend fun findById(id: Uuid): Album?
    /**
     * Returns the paginated album list and the total album count in a single atomic transaction,
     * preventing a race condition where a rescan between two separate calls could produce an
     * inconsistent page response (e.g. count reflects new albums not yet in the page).
     */
    suspend fun findAllWithCount(page: Int, size: Int): Pair<List<Album>, Long>
    suspend fun save(album: Album): Album
    suspend fun saveAll(albums: List<Album>)
}
