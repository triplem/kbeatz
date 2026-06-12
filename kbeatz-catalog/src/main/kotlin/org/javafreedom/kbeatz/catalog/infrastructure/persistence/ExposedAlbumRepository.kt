package org.javafreedom.kbeatz.catalog.infrastructure.persistence

import java.util.UUID
import kotlin.uuid.Uuid
import kotlin.uuid.toKotlinUuid
import org.javafreedom.kbeatz.catalog.domain.model.Album
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumFilter
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumRepository
import org.jetbrains.exposed.v1.core.Count
import org.jetbrains.exposed.v1.core.Expression
import org.jetbrains.exposed.v1.core.LikePattern
import org.jetbrains.exposed.v1.core.LowerCase
import org.jetbrains.exposed.v1.core.Op
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.dao.id.EntityID
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.greaterEq
import org.jetbrains.exposed.v1.core.intLiteral
import org.jetbrains.exposed.v1.core.lessEq
import org.jetbrains.exposed.v1.core.like
import org.jetbrains.exposed.v1.core.or
import org.jetbrains.exposed.v1.core.stringParam
import org.jetbrains.exposed.v1.core.substring
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.select
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.suspendTransaction
import org.jetbrains.exposed.v1.jdbc.update

/**
 * Exposed-backed [AlbumRepository] using H2 (v1) or PostgreSQL (v2 migration target).
 *
 * All database calls run via [suspendTransaction], which handles dispatcher management
 * internally through Exposed's transaction manager.
 * [discogsJson] is excluded from all queries in this repository - it is loaded only by
 * the detail endpoint (story #66) which will query it explicitly.
 */
class ExposedAlbumRepository : AlbumRepository {

    override suspend fun findById(id: Uuid): Album? =
        suspendTransaction {
            AlbumsTable
                .selectAll()
                .where { AlbumsTable.id eq id.toJavaUuid() }
                .singleOrNull()
                ?.toAlbum()
        }

    override suspend fun findAllWithCount(page: Int, size: Int, filter: AlbumFilter): Pair<List<Album>, Long> =
        suspendTransaction {
            // COUNT(*) OVER() window function folds the total into each row - one round-trip
            // instead of two, which matters on a networked PostgreSQL (ADR-006) at scale.
            val totalExpr = Count(intLiteral(1)).over()
            val cols: List<Expression<*>> = AlbumsTable.columns + listOf(totalExpr)
            val whereClause = buildWhereClause(filter)
            val query = if (whereClause != null) {
                AlbumsTable.select(cols).where { whereClause }
            } else {
                AlbumsTable.select(cols)
            }
            val rows = query
                .orderBy(AlbumsTable.albumArtist)
                .limit(size)
                .offset(page.toLong() * size)
                .toList()
            val total = rows.firstOrNull()?.get(totalExpr) ?: 0L
            rows.map { it.toAlbum() } to total
        }

    /**
     * Builds a WHERE clause from the given [filter], or returns null if all fields are blank.
     *
     * All string comparisons are case-insensitive via LOWER(column) LIKE lower-cased pattern.
     * User-supplied text is wrapped with [LikePattern.ofLiteral] so that LIKE metacharacters
     * (`%`, `_`, and the dialect escape char) in the search term are treated as literals and
     * do not produce unintended wildcard behaviour (e.g. searching for "100%" must not match
     * every album).
     *
     * Genre matching uses equality rather than LIKE to enforce the spec's "exact genre" semantics.
     *
     * Year range filters parse the first four characters of the album_date column
     * (stored as 'YYYY' or 'YYYY-MM-DD') as a string prefix comparison.
     */
    @Suppress("ComplexMethod")
    private fun buildWhereClause(filter: AlbumFilter): Op<Boolean>? {
        val conditions = mutableListOf<Op<Boolean>>()

        filter.q?.takeIf { it.isNotBlank() }?.let { q ->
            // Escape LIKE metacharacters so user input is treated as a literal substring.
            val escaped = LikePattern.ofLiteral(q.lowercase())
            val term = LikePattern("%") + escaped + LikePattern("%")
            conditions += (LowerCase(AlbumsTable.albumArtist) like term) or
                (LowerCase(AlbumsTable.album) like term) or
                (LowerCase(AlbumsTable.composer) like term) or
                (LowerCase(AlbumsTable.label) like term)
        }

        filter.albumArtist?.takeIf { it.isNotBlank() }?.let { artist ->
            // Escape LIKE metacharacters so user input is treated as a literal substring.
            val escaped = LikePattern.ofLiteral(artist.lowercase())
            val term = LikePattern("%") + escaped + LikePattern("%")
            conditions += LowerCase(AlbumsTable.albumArtist) like term
        }

        filter.composer?.takeIf { it.isNotBlank() }?.let { composer ->
            // Escape LIKE metacharacters so user input is treated as a literal substring.
            val escaped = LikePattern.ofLiteral(composer.lowercase())
            val term = LikePattern("%") + escaped + LikePattern("%")
            conditions += LowerCase(AlbumsTable.composer) like term
        }

        filter.genre?.takeIf { it.isNotBlank() }?.let { genre ->
            // Exact case-insensitive equality: spec says "Filter by exact genre".
            // Using eq rather than LIKE prevents partial-match surprises (e.g. genre="Jazz%").
            conditions += LowerCase(AlbumsTable.genre) eq stringParam(genre.lowercase())
        }

        filter.yearFrom?.let { yearFrom ->
            // album_date stores 'YYYY' or 'YYYY-MM-DD'; SUBSTRING(album_date, 1, 4) extracts the year
            @Suppress("MagicNumber") // 4 = length of 4-digit year prefix in ISO date strings
            conditions += AlbumsTable.albumDate.substring(1, 4) greaterEq yearFrom.toString()
        }

        filter.yearTo?.let { yearTo ->
            @Suppress("MagicNumber") // 4 = length of 4-digit year prefix in ISO date strings
            conditions += AlbumsTable.albumDate.substring(1, 4) lessEq yearTo.toString()
        }

        return conditions.reduceOrNull { acc, op -> acc and op }
    }

    override suspend fun save(album: Album): Album =
        suspendTransaction {
            val existing = AlbumsTable
                .selectAll()
                .where { AlbumsTable.id eq album.id.toJavaUuid() }
                .singleOrNull()

            if (existing == null) {
                insertAlbum(album)
            } else {
                updateAlbum(album)
            }
            album
        }

    override suspend fun saveAll(albums: List<Album>) {
        if (albums.isEmpty()) return
        // Chunk into batches of 500 to avoid exceeding JDBC parameter binding limits
        // (H2 caps at ~32 767 bound parameters; 4 columns * 500 albums = 2 000, well within limit)
        // and to prevent deeply-nested SQL expression trees that can cause stack-overflow on large
        // libraries.
        albums.chunked(SAVE_ALL_CHUNK_SIZE).forEach { chunk -> saveChunk(chunk) }
    }

    /**
     * Persists a single chunk of albums inside one transaction.
     *
     * Existing albums (matched by natural key) are updated using [updateAlbumStructural], which
     * touches only the four scan-derived columns (albumArtist, album, albumDate, directoryPath).
     * Enriched Discogs metadata (genre, label, catalogNumber, composer, conductor, ensemble,
     * discogsId, images) is intentionally left unchanged so that a library rescan cannot wipe
     * data that was written by a Discogs sync.
     *
     * New albums are inserted with all fields from the [Album] object (which will have nulls for
     * the enriched fields on first scan).
     */
    @Suppress("RedundantSuspendModifier") // suspendTransaction is a suspend function; Detekt false-positive
    private suspend fun saveChunk(chunk: List<Album>) {
        suspendTransaction {
            // Look up existing albums by natural key to reuse their stable UUIDs.
            // This prevents duplicate-insert failures from the unique constraint and ensures
            // URL stability: /albums/<uuid> remains valid across library rescans.
            val naturalKeyFilter = chunk
                .map { album ->
                    (AlbumsTable.albumArtist eq album.albumArtist) and
                        (AlbumsTable.album eq album.album) and
                        (AlbumsTable.albumDate eq (album.date ?: "")) and
                        (AlbumsTable.directoryPath eq album.directoryPath)
                }
                .reduce(Op<Boolean>::or)

            // naturalKey -> existing UUID
            val existingByNaturalKey: Map<NaturalKey, UUID> = AlbumsTable
                .selectAll()
                .where { naturalKeyFilter }
                .associate { row ->
                    NaturalKey(
                        albumArtist = row[AlbumsTable.albumArtist],
                        album = row[AlbumsTable.album],
                        albumDate = row[AlbumsTable.albumDate],
                        directoryPath = row[AlbumsTable.directoryPath],
                    ) to row[AlbumsTable.id].value
                }

            chunk.forEach { album ->
                val key = NaturalKey(
                    albumArtist = album.albumArtist,
                    album = album.album,
                    albumDate = album.date.orEmpty(),
                    directoryPath = album.directoryPath,
                )
                val existingId = existingByNaturalKey[key]
                if (existingId != null) {
                    // Update only structural (scan-derived) columns to preserve Discogs metadata.
                    // A full updateAlbum() would overwrite enriched fields with the nulls that
                    // AlbumGroup.toAlbum() produces, causing silent data loss on every rescan.
                    updateAlbumStructural(album.copy(id = existingId.toKotlinUuid()))
                } else {
                    insertAlbum(album)
                }
            }
        }
    }

    companion object {
        // Maximum albums per saveAll chunk. Keeps the OR-filter SQL expression tree bounded
        // and JDBC parameter count well below H2's 32 767 limit (4 params * 500 = 2 000).
        @Suppress("MagicNumber")
        internal const val SAVE_ALL_CHUNK_SIZE = 500
    }
}

/** Key tuple matching the `uq_albums_identity` unique constraint columns. */
private data class NaturalKey(
    val albumArtist: String,
    val album: String,
    val albumDate: String,
    val directoryPath: String,
)

internal fun Uuid.toJavaUuid(): UUID = UUID.fromString(this.toString())

private fun insertAlbum(album: Album) {
    AlbumsTable.insert {
        it[id] = EntityID(album.id.toJavaUuid(), AlbumsTable)
        it[albumArtist] = album.albumArtist
        it[AlbumsTable.album] = album.album
        it[albumDate] = album.date.orEmpty()
        it[genre] = album.genre
        it[label] = album.label
        it[catalogNumber] = album.catalogNumber
        it[composer] = album.composer
        it[conductor] = album.conductor
        it[ensemble] = album.ensemble
        it[discogsId] = album.discogsId
        it[discogsJson] = null
        it[extraTags] = JsonSerde.encodeExtraTags(album.extraTags)
        it[images] = JsonSerde.encodeImages(album.images)
        it[directoryPath] = album.directoryPath
    }
}

private fun updateAlbum(album: Album) {
    AlbumsTable.update({ AlbumsTable.id eq album.id.toJavaUuid() }) {
        it[albumArtist] = album.albumArtist
        it[AlbumsTable.album] = album.album
        it[albumDate] = album.date.orEmpty()
        it[genre] = album.genre
        it[label] = album.label
        it[catalogNumber] = album.catalogNumber
        it[composer] = album.composer
        it[conductor] = album.conductor
        it[ensemble] = album.ensemble
        it[discogsId] = album.discogsId
        it[extraTags] = JsonSerde.encodeExtraTags(album.extraTags)
        it[images] = JsonSerde.encodeImages(album.images)
        it[directoryPath] = album.directoryPath
    }
}

/**
 * Updates only the four scan-derived structural columns for an album that already exists.
 *
 * Intentionally does NOT touch enriched Discogs fields (genre, label, catalogNumber, composer,
 * conductor, ensemble, discogsId, images). Called from [ExposedAlbumRepository.saveChunk] during
 * library rescan and startup repair so that Discogs-synced data is never overwritten by a rescan
 * that produces Album objects with null enriched fields.
 */
private fun updateAlbumStructural(album: Album) {
    AlbumsTable.update({ AlbumsTable.id eq album.id.toJavaUuid() }) {
        it[albumArtist] = album.albumArtist
        it[AlbumsTable.album] = album.album
        it[albumDate] = album.date.orEmpty()
        it[directoryPath] = album.directoryPath
    }
}

internal fun ResultRow.toAlbum(): Album = Album(
    id = this[AlbumsTable.id].value.toKotlinUuid(),
    albumArtist = this[AlbumsTable.albumArtist],
    album = this[AlbumsTable.album],
    date = this[AlbumsTable.albumDate].ifEmpty { null },
    genre = this[AlbumsTable.genre],
    label = this[AlbumsTable.label],
    catalogNumber = this[AlbumsTable.catalogNumber],
    composer = this[AlbumsTable.composer],
    conductor = this[AlbumsTable.conductor],
    ensemble = this[AlbumsTable.ensemble],
    discogsId = this[AlbumsTable.discogsId],
    extraTags = JsonSerde.decodeExtraTags(this[AlbumsTable.extraTags]),
    images = JsonSerde.decodeImages(this[AlbumsTable.images]),
    directoryPath = this[AlbumsTable.directoryPath],
)
