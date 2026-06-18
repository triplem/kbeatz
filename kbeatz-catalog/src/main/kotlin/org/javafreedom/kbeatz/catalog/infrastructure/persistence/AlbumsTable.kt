package org.javafreedom.kbeatz.catalog.infrastructure.persistence

import org.jetbrains.exposed.v1.core.ReferenceOption
import org.jetbrains.exposed.v1.core.dao.id.java.UUIDTable
import org.jetbrains.exposed.v1.datetime.CurrentTimestamp
import org.jetbrains.exposed.v1.datetime.timestamp

/**
 * Exposed ORM definition for the `albums` table.
 *
 * Mirrors the schema in V1__baseline.yaml exactly. All column names are
 * snake_case to match the SQL schema; Kotlin property names are camelCase.
 *
 * [discogsJson] is excluded from list queries (see ExposedAlbumRepository).
 * [images], [extraTags], and [mergedDirectories] are TEXT storing JSON, serialised at the boundary.
 */
@Suppress("MagicNumber")
object AlbumsTable : UUIDTable("albums") {
    val albumArtist = varchar("album_artist", 500)
    val album = varchar("album", 500)
    val albumDate = varchar("album_date", 50).default("")
    val genre = varchar("genre", 100).nullable()
    val label = varchar("label", 255).nullable()
    val catalogNumber = varchar("catalog_number", 100).nullable()
    val composer = varchar("composer", 500).nullable()
    val conductor = varchar("conductor", 500).nullable()
    val ensemble = varchar("ensemble", 500).nullable()
    val country = varchar("country", 100).nullable()
    val discogsId = varchar("discogs_id", 50).nullable()
    val discogsJson = text("discogs_json").nullable()
    val extraTags = text("extra_tags").nullable()
    val images = text("images").nullable()
    val directoryPath = varchar("directory_path", 2000)
    /**
     * JSON array of absolute directory paths merged into this album during deduplication.
     * Null when the album originates from a single directory (the common case).
     * Populated by [LibraryScanService] when [LibraryWalker] groups tracks from multiple
     * sibling directories into one AlbumGroup.
     */
    val mergedDirectories = text("merged_directories").nullable()
    val createdAt = timestamp("created_at").defaultExpression(CurrentTimestamp)
    val updatedAt = timestamp("updated_at").defaultExpression(CurrentTimestamp)
}

/**
 * Exposed ORM definition for the `tracks` table.
 *
 * [albumId] references [AlbumsTable] with ON DELETE CASCADE enforced at DB level.
 * [images] and [extraTags] are TEXT storing JSON, serialised at the boundary.
 */
@Suppress("MagicNumber")
object TracksTable : UUIDTable("tracks") {
    val albumId = reference("album_id", AlbumsTable, onDelete = ReferenceOption.CASCADE)
    val title = varchar("title", 500).nullable()
    val trackNumber = varchar("track_number", 20).nullable()
    val discNumber = varchar("disc_number", 20).nullable()
    val trackTotal = varchar("track_total", 20).nullable()
    val discTotal = varchar("disc_total", 20).nullable()
    val artist = varchar("artist", 500).nullable()
    val composer = varchar("composer", 500).nullable()
    val conductor = varchar("conductor", 500).nullable()
    val ensemble = varchar("ensemble", 500).nullable()
    val durationSeconds = integer("duration_seconds").nullable()
    val trackPath = varchar("track_path", 2000)
    val images = text("images").nullable()
    val extraTags = text("extra_tags").nullable()
}
