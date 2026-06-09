package org.javafreedom.kbeatz.sources.discogs

import kotlin.time.Instant
import org.javafreedom.kbeatz.common.metadata.KbeatzMetadata

/**
 * Maps a [DiscogsRelease] to the provider-agnostic [KbeatzMetadata] format.
 *
 * ## Track position parsing
 *
 * Discogs encodes disc and track numbers inside the `position` string. The following
 * patterns are recognised (applied in order):
 *
 * | Pattern | Example | Result |
 * |---|---|---|
 * | `CD<disc>-<track>` | "CD01-12" | disc=1, track=12 |
 * | `<disc>-<track>` | "1-02" | disc=1, track=2 |
 * | `<disc>.<track>` | "2.05" | disc=2, track=5 |
 * | Bare integer | "3" | disc=1, track=3 |
 *
 * Entries whose position starts with "Video", "video", or "DVD" are skipped entirely.
 * Entries whose `type_` is not "track" and that have no duration string are treated as
 * index (heading) entries: they are not emitted as playable tracks but their title
 * propagates as `discSubtitle` to the immediately following real tracks.
 *
 * ## Image localPath convention
 *
 * | Discogs image type | pictureType | localPath |
 * |---|---|---|
 * | "primary" (first) | 3 (front cover) | "folder.jpg" |
 * | "primary" (subsequent) | 0 (other) | "0-<index>.jpg" |
 * | "secondary" | 0 (other) | "0-<index>.jpg" |
 *
 * Note: pictureType values follow RFC 9639 section 10.7.
 */
object DiscogsToKbeatzMapper {

    @Suppress("MagicNumber") // RFC 9639 section 10.7 picture-type code: 3=front cover
    private const val PICTURE_TYPE_FRONT_COVER = 3

    @Suppress("MagicNumber") // RFC 9639 section 10.7 picture-type code: 0=other/general
    private const val PICTURE_TYPE_OTHER = 0

    private const val ROLE_COMPOSED_BY = "composed by"
    private const val ROLE_CONDUCTOR = "conductor"
    private const val ROLE_ORCHESTRA = "orchestra"

    private val PATTERN_CD_DISC_TRACK = Regex("""^CD(\d+)-(\d+)$""", RegexOption.IGNORE_CASE)
    private val PATTERN_DISC_DASH_TRACK = Regex("""^(\d+)-(\d+)$""")
    private val PATTERN_DISC_DOT_TRACK = Regex("""^(\d+)\.(\d+)$""")
    private val PATTERN_BARE_INTEGER = Regex("""^(\d+)$""")

    private val SKIP_PREFIXES = listOf("Video", "video", "DVD")

    /**
     * Transforms a [DiscogsRelease] into [KbeatzMetadata].
     *
     * @param release The Discogs release data.
     * @param fetchedAt UTC timestamp when the release was fetched.
     * @return The provider-agnostic metadata document.
     */
    fun map(release: DiscogsRelease, fetchedAt: Instant): KbeatzMetadata {
        val parsedTracks = parseTracks(release.tracklist)
        val discCount = parsedTracks.maxOfOrNull { it.discNumber } ?: 1
        val trackTotals = parsedTracks.groupBy { it.discNumber }.mapValues { (_, tracks) -> tracks.size }

        val tracks = parsedTracks.map { pt ->
            KbeatzMetadata.Track(
                discNumber = pt.discNumber,
                trackNumber = pt.trackNumber,
                trackTotal = trackTotals[pt.discNumber] ?: parsedTracks.size,
                title = pt.title,
                artist = pt.artist,
                duration = pt.duration,
                discSubtitle = pt.discSubtitle,
                originalPosition = pt.originalPosition,
            )
        }

        return KbeatzMetadata(
            source = "discogs",
            sourceId = release.id,
            fetchedAt = fetchedAt,
            album = buildAlbum(release, discCount),
            tracks = tracks,
            images = mapImages(release.images),
        )
    }

    private fun buildAlbum(release: DiscogsRelease, discCount: Int) = KbeatzMetadata.Album(
        title = release.title,
        albumArtist = release.artists.firstOrNull()?.name?.takeIf { it.isNotBlank() }.orEmpty(),
        date = release.year?.toString(),
        genres = release.genres,
        styles = release.styles,
        label = release.labels.firstOrNull()?.name?.takeIf { it.isNotBlank() },
        catalogNumber = release.labels.firstOrNull()?.catno?.takeIf { it.isNotBlank() },
        barcode = release.identifiers?.firstOrNull { it.type == "Barcode" }?.value,
        composer = release.extraartists.firstOrNull { it.role.lowercase() == ROLE_COMPOSED_BY }
            ?.name?.takeIf { it.isNotBlank() },
        conductor = release.extraartists.firstOrNull { it.role.lowercase() == ROLE_CONDUCTOR }
            ?.name?.takeIf { it.isNotBlank() },
        ensemble = release.extraartists.firstOrNull { it.role.lowercase() == ROLE_ORCHESTRA }
            ?.name?.takeIf { it.isNotBlank() },
        discTotal = discCount,
    )

    /**
     * Parses a Discogs `position` string into disc and track number integers.
     *
     * Returns `null` when the position should be skipped (Video, DVD) or cannot be parsed.
     */
    internal fun parsePosition(position: String): DiscTrack? =
        when {
            position.isBlank() -> null
            SKIP_PREFIXES.any { position.startsWith(it) } -> null
            else -> matchPatterns(position)
        }

    /** Ordered list of two-group patterns (disc, track). */
    private val DISC_TRACK_PATTERNS = listOf(
        PATTERN_CD_DISC_TRACK,
        PATTERN_DISC_DASH_TRACK,
        PATTERN_DISC_DOT_TRACK,
    )

    private fun matchPatterns(position: String): DiscTrack? =
        DISC_TRACK_PATTERNS.firstNotNullOfOrNull { pattern ->
            pattern.matchEntire(position)?.let { m -> DiscTrack(m.groupValues[1].toInt(), m.groupValues[2].toInt()) }
        }
            ?: PATTERN_BARE_INTEGER.matchEntire(position)?.let { m -> DiscTrack(1, m.groupValues[1].toInt()) }
            ?: parseSideLetterPosition(position)

    private fun parseSideLetterPosition(position: String): DiscTrack? {
        val digits = position.trimStart { !it.isDigit() }
        return digits.toIntOrNull()?.let { DiscTrack(1, it) }
    }

    /** Intermediate holder used while parsing the Discogs tracklist. */
    internal data class DiscTrack(val disc: Int, val track: Int)

    private data class ParsedTrack(
        val discNumber: Int,
        val trackNumber: Int,
        val title: String,
        val artist: String?,
        val duration: String?,
        val discSubtitle: String?,
        val originalPosition: String?,
    )

    private fun parseTracks(tracklist: List<DiscogsTrack>): List<ParsedTrack> {
        val result = mutableListOf<ParsedTrack>()
        var currentDiscSubtitle: String? = null
        val trackCountPerDisc = mutableMapOf<Int, Int>()

        tracklist.forEach { track ->
            val parsed = processTrackEntry(track, trackCountPerDisc, currentDiscSubtitle)
            if (parsed != null) {
                result.add(parsed)
            } else if (isIndexEntry(track)) {
                currentDiscSubtitle = track.title.takeIf { it.isNotBlank() }
            }
        }
        return result
    }

    private fun processTrackEntry(
        track: DiscogsTrack,
        trackCountPerDisc: MutableMap<Int, Int>,
        currentDiscSubtitle: String?,
    ): ParsedTrack? =
        if (isIndexEntry(track)) {
            null
        } else {
            parsePosition(track.position)?.let { parsed ->
                trackCountPerDisc[parsed.disc] = (trackCountPerDisc[parsed.disc] ?: 0) + 1
                val trackNumber = trackCountPerDisc[parsed.disc] ?: 1
                ParsedTrack(
                    discNumber = parsed.disc,
                    trackNumber = trackNumber,
                    title = track.title,
                    artist = track.artists.firstOrNull()?.name?.takeIf { it.isNotBlank() },
                    duration = track.duration?.takeIf { it.isNotBlank() },
                    discSubtitle = currentDiscSubtitle,
                    originalPosition = track.position.takeIf { it.isNotBlank() },
                )
            }
        }

    /**
     * An index entry is a Discogs tracklist entry that serves as a disc heading.
     * It has no duration (or an empty duration) and its position is blank.
     * Discogs uses these to label sides or discs (e.g. "Side A", "Disc 1").
     */
    private fun isIndexEntry(track: DiscogsTrack): Boolean =
        track.duration.isNullOrBlank() && track.position.isBlank()

    @Suppress("MagicNumber") // pictureType 3 = front cover per RFC 9639 section 10.7
    private fun mapImages(images: List<DiscogsImage>): List<KbeatzMetadata.Image> {
        var frontCoverAssigned = false
        return images.mapIndexed { index, img ->
            val pictureType = if (img.type == "primary" && !frontCoverAssigned) {
                frontCoverAssigned = true
                PICTURE_TYPE_FRONT_COVER
            } else {
                PICTURE_TYPE_OTHER
            }
            KbeatzMetadata.Image(
                pictureType = pictureType,
                description = null,
                mimeType = if (img.uri.endsWith(".png")) "image/png" else "image/jpeg",
                sourceUri = img.uri,
                localPath = localPathFor(pictureType, index),
            )
        }
    }

    @Suppress("MagicNumber") // pictureType 3 = front cover, 4 = back cover per RFC 9639 section 10.7
    private fun localPathFor(pictureType: Int, index: Int): String = when (pictureType) {
        3 -> "folder.jpg"
        4 -> "back.jpg"
        else -> "$pictureType-$index.jpg"
    }
}
