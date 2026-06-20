package org.javafreedom.kbeatz.catalog.application.service

import io.github.oshai.kotlinlogging.KotlinLogging
import java.nio.file.Files
import java.nio.file.Paths
import kotlin.time.Clock
import kotlin.time.Instant
import kotlin.uuid.Uuid
import org.javafreedom.kbeatz.catalog.domain.model.Album
import org.javafreedom.kbeatz.catalog.domain.model.ChangeOperation
import org.javafreedom.kbeatz.catalog.domain.model.ChangePlan
import org.javafreedom.kbeatz.catalog.domain.model.ConflictType
import org.javafreedom.kbeatz.catalog.domain.model.DirectoryMove
import org.javafreedom.kbeatz.catalog.domain.model.PlanConflict
import org.javafreedom.kbeatz.catalog.domain.model.ReleaseChangeSet
import org.javafreedom.kbeatz.catalog.domain.model.WRITE_LOCK_FILENAME
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumRepository
import org.javafreedom.kbeatz.catalog.domain.repository.TrackRepository
import org.javafreedom.kbeatz.catalog.domain.service.DirectoryLayoutPlanner
import org.javafreedom.kbeatz.catalog.domain.service.TagDiffCalculator
import org.javafreedom.kbeatz.common.BusinessValidationException
import org.javafreedom.kbeatz.common.PathTraversalException

private val logger = KotlinLogging.logger {}

/**
 * Read-only filesystem probes used during dry-run planning. Implementations must never
 * write to disk. The default implementation delegates to [java.nio.file.Files].
 */
interface PlanningFilesystem {
    /** Returns true when [absolutePath] exists on disk. */
    fun exists(absolutePath: String): Boolean

    /** Returns true when a write-lock sentinel is present in [directory]. */
    fun lockHeld(directory: String): Boolean
}

/** Default [PlanningFilesystem] backed by [java.nio.file.Files] (read-only checks only). */
object NioPlanningFilesystem : PlanningFilesystem {
    override fun exists(absolutePath: String): Boolean = Files.exists(Paths.get(absolutePath))

    override fun lockHeld(directory: String): Boolean =
        Files.exists(Paths.get(directory).resolve(WRITE_LOCK_FILENAME))
}

/**
 * Builds dry-run [ChangePlan]s that describe directory moves and tag changes for one or
 * many releases. Planning performs ZERO disk writes; only read-only filesystem checks
 * (existence and write-lock presence) are used for conflict detection.
 *
 * @property albumRepository Source of release metadata.
 * @property trackRepository Source of track metadata (reserved for future per-track plans).
 * @property directoryLayoutPlanner Computes target directories from the configured template.
 * @property libraryRoot Absolute path to the music library root.
 * @property filesystem Read-only filesystem probes for conflict detection.
 * @property clock Source of the plan creation timestamp.
 */
class ChangePlanService(
    private val albumRepository: AlbumRepository,
    // Reserved for per-track tag planning in story #817; kept on the constructor so the
    // dependency wiring is stable across stories.
    @Suppress("UnusedPrivateProperty") private val trackRepository: TrackRepository,
    private val directoryLayoutPlanner: DirectoryLayoutPlanner,
    private val libraryRoot: String,
    private val filesystem: PlanningFilesystem = NioPlanningFilesystem,
    private val clock: Clock = Clock.System,
) {

    /**
     * Plans directory relocations for the given releases so each matches the configured
     * directory template. Releases that already match produce no [DirectoryMove].
     *
     * Detected conditions are reported as conflicts, never thrown: a missing album, a
     * missing source directory, an existing target, a held write-lock, or a traversal
     * guard violation.
     *
     * @param albumIds The releases to plan.
     * @return A single consolidated plan with operation [ChangeOperation.RELAYOUT].
     */
    suspend fun planRelayout(albumIds: List<Uuid>): ChangePlan {
        val releases = albumIds.map { albumId ->
            val album = albumRepository.findById(albumId)
            if (album == null) {
                missingAlbumChangeSet(albumId)
            } else {
                planRelayoutForAlbum(album)
            }
        }
        return buildPlan(ChangeOperation.RELAYOUT, releases)
    }

    /**
     * Assembles a tag-change plan for [operation] from supplied album-level tag maps.
     *
     * This is the seam consumed by story #817: it does not read FLAC files or call Discogs. It
     * diffs the supplied current/proposed maps with [TagDiffCalculator] and carries any supplied
     * per-album conflicts (e.g. no Discogs token, missing album, image quota) as plan data rather
     * than failing the whole request.
     *
     * A release that has only a conflict (and no proposed tags) is still included so callers see
     * every problem at once. The release set is the union of [proposedByAlbum] and
     * [conflictsByAlbum] keys.
     *
     * @param operation Must be [ChangeOperation.RETAG] or [ChangeOperation.DISCOGS_SYNC].
     * @param proposedByAlbum Proposed tag values per release.
     * @param currentByAlbum Current tag values per release.
     * @param conflictsByAlbum Conflicts detected while sourcing tags, per release.
     * @return A single consolidated plan with no directory moves.
     * @throws BusinessValidationException if [operation] is [ChangeOperation.RELAYOUT].
     */
    fun planTagChanges(
        operation: ChangeOperation,
        proposedByAlbum: Map<Uuid, Map<String, String>>,
        currentByAlbum: Map<Uuid, Map<String, String>>,
        conflictsByAlbum: Map<Uuid, List<PlanConflict>> = emptyMap(),
    ): ChangePlan {
        if (operation == ChangeOperation.RELAYOUT) {
            throw BusinessValidationException(
                "planTagChanges supports only RETAG or DISCOGS_SYNC, not $operation"
            )
        }
        val albumIds = proposedByAlbum.keys + conflictsByAlbum.keys
        val releases = albumIds.map { albumId ->
            val conflicts = conflictsByAlbum[albumId].orEmpty()
            val current = currentByAlbum[albumId].orEmpty()
            val proposed = proposedByAlbum[albumId].orEmpty()
            ReleaseChangeSet(
                albumId = albumId,
                directoryMove = null,
                // A release with conflicts carries no tag changes: apply must SKIP it untouched.
                tagChanges = if (conflicts.isEmpty()) {
                    TagDiffCalculator.diff(current, proposed, albumId.toString())
                } else {
                    emptyList()
                },
                conflicts = conflicts,
            )
        }
        return buildPlan(operation, releases)
    }

    private fun planRelayoutForAlbum(album: Album): ReleaseChangeSet {
        val target = try {
            directoryLayoutPlanner.planTargetDirectory(album, libraryRoot)
        } catch (e: PathTraversalException) {
            logger.warn { "planRelayout_traversal_conflict albumId=${album.id}" }
            return traversalChangeSet(album, e)
        }

        val sourcePath = album.directoryPath
        val targetPath = target.absolutePath
        val needsMove = targetPath != sourcePath
        val conflicts = detectRelayoutConflicts(album, sourcePath, targetPath, needsMove)
        val directoryMove = if (needsMove) {
            DirectoryMove(
                albumId = album.id,
                fromPath = sourcePath,
                toPath = targetPath,
                mergedFromPaths = album.mergedDirectories,
            )
        } else {
            null
        }
        return ReleaseChangeSet(
            albumId = album.id,
            directoryMove = directoryMove,
            tagChanges = emptyList(),
            conflicts = conflicts,
        )
    }

    private fun detectRelayoutConflicts(
        album: Album,
        sourcePath: String,
        targetPath: String,
        needsMove: Boolean,
    ): List<PlanConflict> = buildList {
        if (!filesystem.exists(sourcePath)) {
            add(
                PlanConflict(
                    type = ConflictType.SOURCE_MISSING,
                    albumId = album.id,
                    path = sourcePath,
                    message = "Source directory does not exist on disk",
                )
            )
        } else if (filesystem.lockHeld(sourcePath)) {
            add(
                PlanConflict(
                    type = ConflictType.LOCK_HELD,
                    albumId = album.id,
                    path = sourcePath,
                    message = "A write-lock is held on the source directory",
                )
            )
        }
        if (needsMove && targetPath != sourcePath && filesystem.exists(targetPath)) {
            add(
                PlanConflict(
                    type = ConflictType.TARGET_EXISTS,
                    albumId = album.id,
                    path = targetPath,
                    message = "Target directory already exists on disk",
                )
            )
        }
    }

    private fun missingAlbumChangeSet(albumId: Uuid): ReleaseChangeSet =
        ReleaseChangeSet(
            albumId = albumId,
            directoryMove = null,
            tagChanges = emptyList(),
            conflicts = listOf(
                PlanConflict(
                    type = ConflictType.SOURCE_MISSING,
                    albumId = albumId,
                    path = null,
                    message = "Album not found",
                )
            ),
        )

    private fun traversalChangeSet(album: Album, e: PathTraversalException): ReleaseChangeSet =
        ReleaseChangeSet(
            albumId = album.id,
            directoryMove = null,
            tagChanges = emptyList(),
            conflicts = listOf(
                PlanConflict(
                    type = ConflictType.PATH_TRAVERSAL,
                    albumId = album.id,
                    path = album.directoryPath,
                    message = e.message ?: "Planned directory escapes the library root",
                )
            ),
        )

    private fun buildPlan(operation: ChangeOperation, releases: List<ReleaseChangeSet>): ChangePlan {
        val plan = ChangePlan(
            id = Uuid.random(),
            operation = operation,
            releases = releases,
            createdAt = currentInstant(),
        )
        logger.info {
            "change_plan_built operation=$operation releases=${plan.releases.size} " +
                "moves=${plan.totalMoves} tagChanges=${plan.totalTagChanges} " +
                "conflicts=${plan.totalConflicts}"
        }
        return plan
    }

    private fun currentInstant(): Instant = clock.now()
}
