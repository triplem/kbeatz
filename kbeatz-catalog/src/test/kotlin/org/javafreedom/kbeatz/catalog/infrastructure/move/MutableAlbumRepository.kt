package org.javafreedom.kbeatz.catalog.infrastructure.move

import kotlin.uuid.Uuid
import org.javafreedom.kbeatz.catalog.domain.model.Album
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumFilter
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumRepository

/**
 * In-memory [AlbumRepository] for move tests. Records [saveCount] so tests can assert that a
 * no-op or already-applied move performs no redundant database write.
 */
class MutableAlbumRepository(vararg seed: Album) : AlbumRepository {
    private val byId = seed.associateBy { it.id }.toMutableMap()

    /** Number of [save] calls since construction. */
    var saveCount: Int = 0
        private set

    fun find(id: Uuid): Album? = byId[id]

    override suspend fun findById(id: Uuid): Album? = byId[id]

    override suspend fun findByIds(ids: List<Uuid>): List<Album> = ids.mapNotNull { byId[it] }

    override suspend fun findByDirectoryPath(directoryPath: String): Album? =
        byId.values.firstOrNull { it.directoryPath == directoryPath }

    override suspend fun findAllWithCount(page: Int, size: Int, filter: AlbumFilter): Pair<List<Album>, Long> =
        byId.values.toList() to byId.size.toLong()

    override suspend fun save(album: Album): Album {
        saveCount++
        byId[album.id] = album
        return album
    }

    override suspend fun saveAll(albums: List<Album>) {
        albums.forEach { byId[it.id] = it }
    }
}
