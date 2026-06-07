package org.javafreedom.kbeatz.catalog.domain.repository

import kotlin.uuid.Uuid
import org.javafreedom.kbeatz.catalog.domain.model.Album

interface AlbumRepository {
    suspend fun findById(id: Uuid): Album?
    suspend fun findAll(page: Int, size: Int): List<Album>
    suspend fun count(): Long
    /**
     * Returns the paginated album list and the total album count in a single atomic transaction,
     * preventing a race condition where a rescan between two separate calls could produce an
     * inconsistent page response (e.g. count reflects new albums not yet in the page).
     */
    suspend fun findAllWithCount(page: Int, size: Int): Pair<List<Album>, Long>
    /**
     * Looks up an existing album by its natural key: (albumArtist, album, date, directoryPath).
     * Returns the existing [Uuid] if found, `null` if this is a new album.
     *
     * Used during library rescan to reuse stable UUIDs instead of assigning fresh random ones,
     * preserving URL stability for bookmarked album pages.
     */
    suspend fun findIdByNaturalKey(albumArtist: String, album: String, date: String?, directoryPath: String): Uuid?
    suspend fun save(album: Album): Album
    suspend fun saveAll(albums: List<Album>)
}
