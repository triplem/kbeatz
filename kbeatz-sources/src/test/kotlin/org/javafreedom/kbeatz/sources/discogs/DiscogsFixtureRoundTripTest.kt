package org.javafreedom.kbeatz.sources.discogs

import kotlin.test.Test
import kotlin.test.assertTrue
import kotlin.time.Clock

/**
 * Fixture-driven round-trip tests for all 9 Discogs JSON fixtures.
 *
 * Each test iterates over every fixture and verifies:
 * 1. [DiscogsRelease.toDomain] produces a [org.javafreedom.kbeatz.sources.Release]
 *    with non-blank title and sourceId.
 * 2. [DiscogsToKbeatzMapper.map] produces [org.javafreedom.kbeatz.common.metadata.KbeatzMetadata]
 *    with non-blank album title.
 * 3. The [org.javafreedom.kbeatz.common.metadata.KbeatzMetadata.tracks] size matches the count of
 *    fixture tracks that the mapper would include: non-blank position, not starting with a skip
 *    prefix (Video, video, DVD), and not an index entry (blank position + blank/null duration).
 *    Tracks that fail these criteria are excluded from the mapped output.
 *
 * The fixtures live at `src/test/resources/discogs/` and are loaded via [DiscogsFixtureLoader].
 */
class DiscogsFixtureRoundTripTest {

    private val skipPrefixes = listOf("Video", "video", "DVD")

    @Test
    fun `toDomain returns Release with non-blank title and sourceId for all fixtures`() {
        for ((filename, release) in DiscogsFixtureLoader.loadAll()) {
            val domain = release.toDomain()
            assertTrue(
                domain.title.isNotBlank(),
                "[$filename] expected non-blank title but was empty"
            )
            assertTrue(
                domain.sourceId.isNotBlank(),
                "[$filename] expected non-blank sourceId but was empty"
            )
        }
    }

    @Test
    fun `DiscogsToKbeatzMapper map returns KbeatzMetadata with non-blank album title for all fixtures`() {
        val now = Clock.System.now()
        for ((filename, release) in DiscogsFixtureLoader.loadAll()) {
            val metadata = DiscogsToKbeatzMapper.map(release, now)
            assertTrue(
                metadata.album.title.isNotBlank(),
                "[$filename] expected non-blank album title but was empty"
            )
        }
    }

    @Test
    fun `mapped tracks exclude index entries and skip-prefix positions for all fixtures`() {
        val now = Clock.System.now()
        for ((filename, release) in DiscogsFixtureLoader.loadAll()) {
            val expectedTrackCount = release.tracklist.count { track ->
                val pos = track.position
                val isIndexEntry = pos.isBlank() && track.duration.isNullOrBlank()
                val isSkipPrefix = skipPrefixes.any { pos.startsWith(it) }
                !isIndexEntry && pos.isNotBlank() && !isSkipPrefix
            }
            val metadata = DiscogsToKbeatzMapper.map(release, now)
            val actualTrackCount = metadata.tracks.size
            assertTrue(
                actualTrackCount == expectedTrackCount,
                "[$filename] expected $expectedTrackCount playable tracks " +
                    "but metadata has $actualTrackCount"
            )
        }
    }
}
