package org.javafreedom.kbeatz.catalog.domain.repository

import kotlin.uuid.Uuid
import org.javafreedom.kbeatz.catalog.domain.model.Album

/**
 * Server-side filter criteria for album list queries.
 *
 * All fields are optional. A null value means "no filter on this field".
 * String fields use case-insensitive substring matching.
 */
data class AlbumFilter(
    /** Free-text search across album title, albumArtist, composer, and label. */
    val q: String? = null,
    /** Filter by albumArtist (case-insensitive contains). */
    val albumArtist: String? = null,
    /** Filter by composer (case-insensitive contains). */
    val composer: String? = null,
    /** Filter by exact genre (case-insensitive). */
    val genre: String? = null,
    /** Filter albums released on or after this year (inclusive). */
    val yearFrom: Int? = null,
    /** Filter albums released on or before this year (inclusive). */
    val yearTo: Int? = null,
)

interface AlbumRepository {
    suspend fun findById(id: Uuid): Album?
    /**
     * Returns the paginated album list and the total album count in a single atomic transaction,
     * preventing a race condition where a rescan between two separate calls could produce an
     * inconsistent page response (e.g. count reflects new albums not yet in the page).
     *
     * When [filter] is non-null the query applies all non-null filter fields server-side.
     * An empty (all-null) [AlbumFilter] is equivalent to passing null.
     */
    suspend fun findAllWithCount(page: Int, size: Int, filter: AlbumFilter = AlbumFilter()): Pair<List<Album>, Long>
    suspend fun save(album: Album): Album
    suspend fun saveAll(albums: List<Album>)
}
