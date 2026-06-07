package org.javafreedom.kbeatz.catalog.infrastructure.persistence

import java.util.UUID
import kotlin.uuid.Uuid
import kotlin.uuid.toKotlinUuid
import org.javafreedom.kbeatz.catalog.domain.model.Album
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumRepository
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.dao.id.EntityID
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.suspendTransaction
import org.jetbrains.exposed.v1.jdbc.update

/**
 * Exposed-backed [AlbumRepository] using H2 (v1) or PostgreSQL (v2 migration target).
 *
 * All database calls run via [suspendTransaction], which handles dispatcher management
 * internally through Exposed's transaction manager.
 * [discogsJson] is excluded from all queries in this repository — it is loaded only by
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

    override suspend fun findAll(page: Int, size: Int): List<Album> =
        suspendTransaction {
            AlbumsTable
                .selectAll()
                .orderBy(AlbumsTable.albumArtist)
                .limit(size).offset(page.toLong() * size)
                .map { it.toAlbum() }
        }

    override suspend fun count(): Long =
        suspendTransaction {
            AlbumsTable.selectAll().count()
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
        suspendTransaction {
            val javaUuids = albums.map { it.id.toJavaUuid() }
            val existingIds = AlbumsTable
                .selectAll()
                .where { AlbumsTable.id inList javaUuids }
                .map { it[AlbumsTable.id].value }
                .toSet()

            albums.forEach { album ->
                if (album.id.toJavaUuid() in existingIds) {
                    updateAlbum(album)
                } else {
                    insertAlbum(album)
                }
            }
        }
    }
}

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
