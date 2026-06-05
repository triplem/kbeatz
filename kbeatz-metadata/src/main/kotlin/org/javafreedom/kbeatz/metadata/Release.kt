package org.javafreedom.kbeatz.metadata

import kotlinx.datetime.LocalDate

/** Source-agnostic release domain model populated from any [MetadataSource]. */
data class Release(
    val sourceId: String,           // e.g. "12345678" (Discogs release ID)
    val sourceName: String,         // e.g. "discogs"
    val title: String,
    val artists: List<ReleaseArtist>,
    val extraArtists: List<ReleaseArtist>,
    val year: Int?,
    val released: LocalDate?,
    val labels: List<Label>,
    val genres: List<String>,
    val styles: List<String>,
    val country: String?,
    val notes: String?,
    val tracklist: List<Track>,
    val images: List<ReleaseImage>,
    val masterUrl: String?,
    val resourceUrl: String?,
    val barcode: String?,
)

data class ReleaseArtist(
    val id: String,
    val name: String,
    /** Role for extra artists — e.g. "Composed By", "Conductor", "Orchestra". Null for primary artists. */
    val role: String? = null,
    val join: String? = null,
)

data class Label(
    val name: String,
    val catno: String,
)

data class Track(
    val position: String,
    val title: String,
    val duration: String?,
    val artists: List<ReleaseArtist>,
    val extraArtists: List<ReleaseArtist>,
)

data class ReleaseImage(
    val type: String,               // "primary" or "secondary"
    val uri: String,
    val width: Int,
    val height: Int,
)
