package org.javafreedom.kbeatz.sources.discogs

import kotlinx.datetime.LocalDate
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import org.javafreedom.kbeatz.sources.Label
import org.javafreedom.kbeatz.sources.Release
import org.javafreedom.kbeatz.sources.ReleaseArtist
import org.javafreedom.kbeatz.sources.ReleaseImage
import org.javafreedom.kbeatz.sources.Track

@Serializable
data class DiscogsArtist(
    val id: Int = 0,
    val name: String = "",
    val role: String = "",
    val join: String? = null,
)

@Serializable
data class DiscogsLabel(
    val name: String = "",
    val catno: String = "",
)

@Serializable
data class DiscogsImage(
    val type: String = "",
    val uri: String = "",
    val width: Int = 0,
    val height: Int = 0,
)

@Serializable
data class DiscogsIdentifier(
    val type: String = "",
    val value: String = "",
)

@Serializable
data class DiscogsTrack(
    val position: String = "",
    val title: String = "",
    val duration: String? = null,
    val artists: List<DiscogsArtist> = emptyList(),
    val extraartists: List<DiscogsArtist> = emptyList(),
)

@Serializable
data class DiscogsRelease(
    val id: Int,
    val title: String,
    val artists: List<DiscogsArtist> = emptyList(),
    val extraartists: List<DiscogsArtist> = emptyList(),
    val year: Int? = null,
    val released: String? = null,
    val labels: List<DiscogsLabel> = emptyList(),
    val genres: List<String> = emptyList(),
    val styles: List<String> = emptyList(),
    val country: String? = null,
    val notes: String? = null,
    val tracklist: List<DiscogsTrack> = emptyList(),
    val images: List<DiscogsImage> = emptyList(),
    @SerialName("master_url") val masterUrl: String? = null,
    @SerialName("master_id") val masterId: Int? = null,
    @SerialName("resource_url") val resourceUrl: String? = null,
    val identifiers: List<DiscogsIdentifier>? = null,
)

/** Maps a Discogs API response to the source-agnostic [Release] domain model. */
fun DiscogsRelease.toDomain(): Release {
    val releasedDate = released?.takeIf { it.isNotBlank() }?.let {
        try {
            LocalDate.parse(it)
        } catch (_: Exception) {
            null
        }
    }
    val barcode = identifiers?.firstOrNull { it.type == "Barcode" }?.value

    return Release(
        sourceId = id.toString(),
        sourceName = "discogs",
        title = title,
        artists = artists.map { it.toReleaseArtist(includeRole = false) },
        extraArtists = extraartists.map { it.toReleaseArtist(includeRole = true) },
        year = year,
        released = releasedDate,
        labels = labels.map { Label(name = it.name, catno = it.catno) },
        genres = genres,
        styles = styles,
        country = country,
        notes = notes,
        tracklist = tracklist.map { it.toTrack() },
        images = images.map { ReleaseImage(type = it.type, uri = it.uri, width = it.width, height = it.height) },
        masterUrl = masterUrl,
        resourceUrl = resourceUrl,
        barcode = barcode,
    )
}

private fun DiscogsArtist.toReleaseArtist(includeRole: Boolean) = ReleaseArtist(
    id = id.toString(),
    name = name,
    role = if (includeRole) role.takeIf { it.isNotBlank() } else null,
    join = join,
)

private fun DiscogsTrack.toTrack() = Track(
    position = position,
    title = title,
    duration = duration,
    artists = artists.map { it.toReleaseArtist(includeRole = false) },
    extraArtists = extraartists.map { it.toReleaseArtist(includeRole = true) },
)
