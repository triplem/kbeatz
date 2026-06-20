package org.javafreedom.kbeatz.common

sealed class DomainException(message: String) : RuntimeException(message)

class ResourceNotFoundException(resource: String, id: String) : DomainException("$resource '$id' not found")
class BusinessValidationException(message: String) : DomainException(message)
class ConflictException(message: String) : DomainException(message)

/**
 * Thrown when a path resolves outside its permitted root (a path-traversal rejection, NFR-06).
 *
 * This is a domain signal, not the JVM's [SecurityException]: catching the broad JDK type would
 * mask unrelated security failures, and a directory-layout violation is a domain rule, not a JVM
 * permission failure. Guards (the directory-layout planner and the on-disk path guard) raise this
 * so callers can react to a traversal specifically without swallowing other exceptions.
 *
 * @param message Human-readable description of the rejected path (must not leak full disk paths to clients).
 */
class PathTraversalException(message: String) : DomainException(message)

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
