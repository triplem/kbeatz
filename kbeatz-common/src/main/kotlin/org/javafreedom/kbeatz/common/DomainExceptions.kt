package org.javafreedom.kbeatz.common

sealed class DomainException(message: String) : RuntimeException(message)

class ResourceNotFoundException(resource: String, id: String) : DomainException("$resource '$id' not found")
class BusinessValidationException(message: String) : DomainException(message)
class ConflictException(message: String) : DomainException(message)

/**
 * Thrown when a Discogs image download is attempted but the daily quota (1 000/day) is exhausted.
 *
 * @param resetAt UTC timestamp (ISO 8601) of when the quota will reset (midnight UTC).
 */
class ImageQuotaExhaustedException(val resetAt: String) : DomainException(
    "Discogs daily image quota exhausted. Quota resets at $resetAt"
)

/**
 * Thrown when the number of FLAC files in a disc subdirectory does not match the expected
 * track count for that disc in the album metadata.
 *
 * This is a hard error: the entire album write is aborted when this exception is thrown, and
 * no FLAC files are modified. A mismatch means the metadata assignment for the disc is wrong
 * or the directory is incomplete.
 *
 * @param albumDir     Path to the album root directory (as a string for serialization safety).
 * @param discNumber   The disc number that has mismatched counts.
 * @param expectedTracks  Number of tracks declared for this disc in the metadata.
 * @param actualFiles  Number of FLAC files found in the disc subdirectory.
 */
class FlacTrackCountMismatchException(
    val albumDir: String,
    val discNumber: Int,
    val expectedTracks: Int,
    val actualFiles: Int,
) : DomainException(
    "FLAC file count mismatch for disc $discNumber in $albumDir: " +
        "expected $expectedTracks tracks but found $actualFiles FLAC files. " +
        "Verify the metadata.yml disc assignment is correct."
)
