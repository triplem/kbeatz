package org.javafreedom.kbeatz.catalog.infrastructure.persistence

import kotlin.uuid.Uuid
import kotlin.uuid.toKotlinUuid
import org.javafreedom.kbeatz.catalog.domain.model.Track
import org.javafreedom.kbeatz.catalog.domain.repository.TrackRepository
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.dao.id.EntityID
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.suspendTransaction
import org.jetbrains.exposed.v1.jdbc.update

/**
 * Exposed-backed [TrackRepository] using H2 (v1) or PostgreSQL (v2 migration target).
 *
 * All database calls run via [suspendTransaction], which handles dispatcher management
 * internally through Exposed's transaction manager.
 */
class ExposedTrackRepository : TrackRepository {

    override suspend fun findByAlbumId(albumId: Uuid): List<Track> =
        suspendTransaction {
            TracksTable
                .selectAll()
                .where { TracksTable.albumId eq albumId.toJavaUuid() }
                .map { it.toTrack() }
        }

    override suspend fun saveAll(tracks: List<Track>) {
        suspendTransaction {
            tracks.forEach { track ->
                TracksTable.insert {
                    it[id] = EntityID(track.id.toJavaUuid(), TracksTable)
                    it[albumId] = track.albumId.toJavaUuid()
                    it[title] = track.title
                    it[trackNumber] = track.trackNumber
                    it[discNumber] = track.discNumber
                    it[trackTotal] = track.trackTotal
                    it[discTotal] = track.discTotal
                    it[artist] = track.artist
                    it[composer] = track.composer
                    it[conductor] = track.conductor
                    it[ensemble] = track.ensemble
                    it[durationSeconds] = track.durationSeconds
                    it[trackPath] = track.path
                    it[images] = JsonSerde.encodeImages(track.images)
                    it[extraTags] = JsonSerde.encodeExtraTags(track.extraTags)
                }
            }
        }
    }

    override suspend fun update(track: Track) {
        suspendTransaction {
            TracksTable.update({ TracksTable.id eq track.id.toJavaUuid() }) {
                it[title] = track.title
                it[trackNumber] = track.trackNumber
                it[discNumber] = track.discNumber
                it[trackTotal] = track.trackTotal
                it[discTotal] = track.discTotal
                it[artist] = track.artist
                it[composer] = track.composer
                it[conductor] = track.conductor
                it[ensemble] = track.ensemble
                it[durationSeconds] = track.durationSeconds
                it[trackPath] = track.path
                it[images] = JsonSerde.encodeImages(track.images)
                it[extraTags] = JsonSerde.encodeExtraTags(track.extraTags)
            }
        }
    }

    override suspend fun deleteByAlbumId(albumId: Uuid) {
        suspendTransaction {
            TracksTable.deleteWhere { TracksTable.albumId eq albumId.toJavaUuid() }
        }
    }
}

private fun ResultRow.toTrack(): Track = Track(
    id = this[TracksTable.id].value.toKotlinUuid(),
    albumId = this[TracksTable.albumId].value.toKotlinUuid(),
    title = this[TracksTable.title],
    trackNumber = this[TracksTable.trackNumber],
    discNumber = this[TracksTable.discNumber],
    trackTotal = this[TracksTable.trackTotal],
    discTotal = this[TracksTable.discTotal],
    artist = this[TracksTable.artist],
    composer = this[TracksTable.composer],
    conductor = this[TracksTable.conductor],
    ensemble = this[TracksTable.ensemble],
    durationSeconds = this[TracksTable.durationSeconds],
    path = this[TracksTable.trackPath],
    images = JsonSerde.decodeImages(this[TracksTable.images]),
    extraTags = JsonSerde.decodeExtraTags(this[TracksTable.extraTags]),
)
