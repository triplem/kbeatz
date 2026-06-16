package org.javafreedom.kbeatz.common.metadata

import kotlin.time.Instant
import kotlinx.serialization.Serializable

/**
 * Provider-agnostic album metadata exchanged between kbeatz-sources and kbeatz-tagger.
 *
 * This is the canonical intermediate representation written by a MetadataSource adapter
 * (e.g. Discogs) and read by TaggerService. Neither module needs to import from the other.
 *
 * @param schemaVersion Schema version for forward-compatibility checks. Currently 1.
 * @param source        Provider identifier - "discogs", "musicbrainz", etc.
 * @param sourceId      Provider-specific release identifier (e.g. Discogs release ID).
 * @param fetchedAt     UTC timestamp when the metadata was fetched from the provider.
 * @param album         Album-level fields shared across all discs and tracks.
 * @param tracks        Ordered list of tracks; multi-disc albums use discNumber to group.
 * @param images        Cover art and other associated images for this release.
 */
@Serializable
data class KbeatzMetadata(
    val schemaVersion: Int = 1,
    val source: String,
    val sourceId: String,
    val fetchedAt: Instant,
    val album: Album,
    val tracks: List<Track>,
    val images: List<Image>,
) {

    /**
     * Album-level fields that apply to all discs and tracks.
     *
     * Classical music extensions (composer, conductor, ensemble) are optional;
     * they map to standard Vorbis Comment fields when present.
     */
    @Serializable
    data class Album(
        val title: String,
        val albumArtist: String,
        val date: String?,
        val genres: List<String> = emptyList(),
        val styles: List<String> = emptyList(),
        val label: String?,
        val catalogNumber: String?,
        val barcode: String?,
        val composer: String?,
        val conductor: String?,
        val ensemble: String?,
        val discTotal: Int = 1,
    )

    /**
     * A single track entry.
     *
     * For multi-disc albums, [discNumber] distinguishes which disc the track belongs to.
     * [originalPosition] carries the raw position string from the provider (e.g. "2-03",
     * "A1", "B2") for reference; [discNumber] and [trackNumber] are the parsed integers.
     */
    @Serializable
    data class Track(
        val discNumber: Int = 1,
        val trackNumber: Int,
        val trackTotal: Int,
        val title: String,
        val artist: String?,
        val duration: String?,
        val discSubtitle: String?,
        val originalPosition: String?,
    )

    /**
     * An image associated with the release.
     *
     * [pictureType] is the FLAC/ID3 picture type integer as defined in RFC 9639 section 10.7
     * (3 = front cover, 4 = back cover, 5 = leaflet/booklet, 6 = media/disc label, ...).
     *
     * [localPath] is a path relative to the album directory set by the metadata mapper.
     * TaggerService reads this path; it never writes it. The convention is:
     *   - Front cover (pictureType=3): "folder.jpg"
     *   - Back cover (pictureType=4): "back.jpg"
     *   - Other types: "<type>-<index>.jpg"
     */
    @Serializable
    data class Image(
        @Suppress("MagicNumber") // RFC 9639 section 10.7 picture type integer
        val pictureType: Int,
        val description: String?,
        val mimeType: String?,
        val sourceUri: String,
        val localPath: String,
    )
}
