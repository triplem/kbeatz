package org.javafreedom.kbeatz.catalog.domain.model

import kotlin.time.Instant
import kotlin.uuid.Uuid

/**
 * The kind of bulk operation a [ChangePlan] describes.
 *
 * - [RELAYOUT]: move release directories to match the configured directory template.
 * - [RETAG]: apply manually-supplied tag values to FLAC files.
 * - [DISCOGS_SYNC]: apply tag values sourced from a Discogs release.
 */
enum class ChangeOperation { RELAYOUT, RETAG, DISCOGS_SYNC }

/**
 * The category of a [PlanConflict] detected during dry-run planning.
 *
 * - [TARGET_EXISTS]: the planned target directory already exists on disk.
 * - [PATH_TRAVERSAL]: the planned target escapes the configured library root.
 * - [SOURCE_MISSING]: the album or its source directory could not be found.
 * - [LOCK_HELD]: a write-lock sentinel file is present in the source directory.
 */
enum class ConflictType { TARGET_EXISTS, PATH_TRAVERSAL, SOURCE_MISSING, LOCK_HELD }

/**
 * A single condition that prevents (or warns about) applying part of a plan.
 *
 * Conflicts are surfaced during planning rather than thrown as failures, so a
 * consolidated plan can list every problem across all releases at once.
 *
 * @property type The category of conflict.
 * @property albumId The release the conflict relates to.
 * @property path The on-disk path involved, when applicable.
 * @property message A human-readable explanation (no PII or secrets).
 */
data class PlanConflict(
    val type: ConflictType,
    val albumId: Uuid,
    val path: String?,
    val message: String,
)

/**
 * A planned directory relocation for one release.
 *
 * No move is performed by constructing this value: it is a planning artifact only.
 *
 * @property albumId The release being moved.
 * @property fromPath The current absolute directory path ([Album.directoryPath]).
 * @property toPath The planned absolute target directory path.
 * @property mergedFromPaths Additional merged source directories that also relocate.
 */
data class DirectoryMove(
    val albumId: Uuid,
    val fromPath: String,
    val toPath: String,
    val mergedFromPaths: List<String> = emptyList(),
)

/**
 * A single proposed tag-field change for a target file or scope.
 *
 * @property targetPath Identifies the file or scope the change applies to.
 * @property field The Vorbis Comment field name (e.g. `ALBUM`, `TITLE`).
 * @property currentValue The current value, or null when the field is absent.
 * @property proposedValue The proposed value, or null when the field is removed.
 */
data class TagChange(
    val targetPath: String,
    val field: String,
    val currentValue: String?,
    val proposedValue: String?,
)

/**
 * The complete set of planned changes for a single release.
 *
 * @property albumId The release this change set describes.
 * @property directoryMove The planned move, or null when the directory already matches.
 * @property tagChanges The per-field tag diffs; empty for a pure relayout.
 * @property conflicts Any conflicts detected for this release during planning.
 */
data class ReleaseChangeSet(
    val albumId: Uuid,
    val directoryMove: DirectoryMove?,
    val tagChanges: List<TagChange>,
    val conflicts: List<PlanConflict>,
) {
    /** True when this release has at least one conflict. */
    val hasConflicts: Boolean get() = conflicts.isNotEmpty()
}

/**
 * A consolidated, dry-run plan describing every directory move and tag change for
 * one or many releases under a single [ChangeOperation].
 *
 * Producing a plan performs zero disk writes. Read-only filesystem checks may be used
 * to populate [ReleaseChangeSet.conflicts].
 *
 * @property id Unique identifier for this plan instance.
 * @property operation The operation the plan was computed for.
 * @property releases The per-release change sets, one entry per requested release.
 * @property createdAt When the plan was assembled.
 */
data class ChangePlan(
    val id: Uuid,
    val operation: ChangeOperation,
    val releases: List<ReleaseChangeSet>,
    val createdAt: Instant,
) {
    /** True when any release in the plan has at least one conflict. */
    val hasConflicts: Boolean get() = releases.any { it.hasConflicts }

    /** The total number of directory moves across all releases. */
    val totalMoves: Int get() = releases.count { it.directoryMove != null }

    /** The total number of tag changes across all releases. */
    val totalTagChanges: Int get() = releases.sumOf { it.tagChanges.size }

    /** The total number of conflicts across all releases. */
    val totalConflicts: Int get() = releases.sumOf { it.conflicts.size }
}
