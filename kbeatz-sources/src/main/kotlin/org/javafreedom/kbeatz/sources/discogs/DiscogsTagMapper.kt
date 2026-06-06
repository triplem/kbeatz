package org.javafreedom.kbeatz.sources.discogs

/**
 * Maps a [DiscogsRelease] to a flat `Map<String, String>` of Vorbis Comment tag fields.
 *
 * This is a pure function: no I/O, no side effects.
 *
 * ## Mapping rules
 *
 * | Discogs field | Vorbis Comment tag |
 * |---|---|
 * | `id` | DISCOGS_RELEASE_ID |
 * | `master_id` (if > 0) | DISCOGS_MASTER_ID |
 * | `artists[0].name` | ALBUMARTIST |
 * | `title` | ALBUM |
 * | `year` | DATE |
 * | `genres[0]` | GENRE |
 * | `styles` joined with ", " | STYLE, GROUPING |
 * | `labels[0].name` | LABEL |
 * | `labels[0].catno` | CATALOGNUMBER |
 * | `identifiers[Barcode]` | BARCODE |
 * | `extraArtists[role≈Composed By]` | COMPOSER |
 * | `extraArtists[role≈Conductor]` | CONDUCTOR |
 * | `extraArtists[role≈Orchestra]` | ENSEMBLE |
 *
 * Track-level fields (TITLE, TRACKNUMBER) are returned per track via [trackTags].
 *
 * Optional fields that are null or empty are **omitted** from the result map — they do
 * not produce empty-string entries.
 */
object DiscogsTagMapper {

    private const val ROLE_COMPOSED_BY = "composed by"
    private const val ROLE_CONDUCTOR = "conductor"
    private const val ROLE_ORCHESTRA = "orchestra"

    /**
     * Maps album-level Discogs fields to Vorbis Comment tags.
     *
     * @return immutable map of tag name → value; missing optional fields are absent.
     */
    fun albumTags(release: DiscogsRelease): Map<String, String> {
        val tags = mutableMapOf<String, String>()

        tags["DISCOGS_RELEASE_ID"] = release.id

        release.masterId?.takeIf { it > 0 }?.let { tags["DISCOGS_MASTER_ID"] = it.toString() }

        release.artists.firstOrNull()?.name?.takeIf { it.isNotBlank() }
            ?.let { tags["ALBUMARTIST"] = it }

        tags["ALBUM"] = release.title

        release.year?.let { tags["DATE"] = it.toString() }

        release.genres.firstOrNull()?.takeIf { it.isNotBlank() }
            ?.let { tags["GENRE"] = it }

        if (release.styles.isNotEmpty()) {
            val joined = release.styles.joinToString(", ")
            tags["STYLE"] = joined
            tags["GROUPING"] = joined
        }

        release.labels.firstOrNull()?.let { label ->
            label.name.takeIf { it.isNotBlank() }?.let { tags["LABEL"] = it }
            label.catno.takeIf { it.isNotBlank() }?.let { tags["CATALOGNUMBER"] = it }
        }

        release.identifiers?.firstOrNull { it.type == "Barcode" }?.value
            ?.takeIf { it.isNotBlank() }?.let { tags["BARCODE"] = it }

        release.extraartists.firstOrNull { it.role.lowercase() == ROLE_COMPOSED_BY }?.name
            ?.takeIf { it.isNotBlank() }?.let { tags["COMPOSER"] = it }

        release.extraartists.firstOrNull { it.role.lowercase() == ROLE_CONDUCTOR }?.name
            ?.takeIf { it.isNotBlank() }?.let { tags["CONDUCTOR"] = it }

        release.extraartists.firstOrNull { it.role.lowercase() == ROLE_ORCHESTRA }?.name
            ?.takeIf { it.isNotBlank() }?.let { tags["ENSEMBLE"] = it }

        return tags.toMap()
    }

    /**
     * Maps track-level fields from a [DiscogsTrack] to Vorbis Comment tags.
     *
     * Extracts the numeric part of the [DiscogsTrack.position] (e.g. "A1" → "1", "B3" → "3").
     * When the position is already numeric it is used as-is.
     *
     * @return immutable map of tag name → value; missing optional fields are absent.
     */
    fun trackTags(track: DiscogsTrack): Map<String, String> {
        val tags = mutableMapOf<String, String>()

        track.title.takeIf { it.isNotBlank() }?.let { tags["TITLE"] = it }

        extractTrackNumber(track.position)?.let { tags["TRACKNUMBER"] = it }

        return tags.toMap()
    }

    /**
     * Extracts the numeric portion from a Discogs track position string.
     *
     * Examples:
     * - "1" → "1"
     * - "A1" → "1"
     * - "B3" → "3"
     * - "10" → "10"
     * - "" → null
     */
    internal fun extractTrackNumber(position: String): String? =
        position.takeIf { it.isNotBlank() }
            ?.trimStart { !it.isDigit() }
            ?.takeIf { it.isNotEmpty() }
}
