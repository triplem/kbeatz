package org.javafreedom.kbeatz.tagger.service

import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.io.files.Path
import kotlinx.io.files.SystemFileSystem
import org.javafreedom.kbeatz.common.FlacTrackCountMismatchException

private val log = KotlinLogging.logger {}

/**
 * Validates that the number of FLAC files in a disc directory matches the expected
 * track count declared in the album metadata.
 *
 * This validation must run before any FLAC files are written. A mismatch is a hard error:
 * it indicates the metadata disc assignment is inconsistent with the actual files on disk.
 * The entire album write is aborted by throwing [FlacTrackCountMismatchException].
 *
 * @see FlacTrackCountMismatchException
 */
object FlacTrackCountValidator {

    /**
     * Validates that the number of FLAC files in [discDir] equals [expectedTrackCount].
     *
     * Logs an ERROR with structured fields before throwing if the counts do not match.
     * The log message includes albumDir, discNumber, expectedTracks, and actualFiles so that
     * log aggregation can surface mismatches without parsing exception messages.
     *
     * @param albumDir         Path to the album root directory (for logging and exception context).
     * @param discDir          Path to the disc subdirectory containing the FLAC files to count.
     * @param discNumber       Disc number (1-based) for logging and exception context.
     * @param expectedTrackCount  Number of tracks declared for this disc in the metadata.
     * @throws FlacTrackCountMismatchException if the FLAC file count does not match.
     */
    fun validate(albumDir: Path, discDir: Path, discNumber: Int, expectedTrackCount: Int) {
        val flacCount = countFlacFiles(discDir)
        if (flacCount != expectedTrackCount) {
            log.error {
                "flac_track_count_mismatch albumDir=$albumDir discNumber=$discNumber " +
                    "expectedTracks=$expectedTrackCount actualFiles=$flacCount"
            }
            throw FlacTrackCountMismatchException(
                albumDir = albumDir.toString(),
                discNumber = discNumber,
                expectedTracks = expectedTrackCount,
                actualFiles = flacCount,
            )
        }
    }

    private fun countFlacFiles(dir: Path): Int =
        runCatching { SystemFileSystem.list(dir) }
            .getOrElse { emptyList() }
            .count { it.name.endsWith(".flac", ignoreCase = true) }
}
