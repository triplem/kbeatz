package org.javafreedom.kbeatz.catalog.application.service

import io.github.oshai.kotlinlogging.KotlinLogging
import java.nio.file.Path
import kotlin.uuid.Uuid
import org.javafreedom.kbeatz.catalog.domain.model.TagChange
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumRepository
import org.javafreedom.kbeatz.catalog.infrastructure.tag.FlacTagWriter
import org.javafreedom.kbeatz.common.ResourceNotFoundException

private val logger = KotlinLogging.logger {}

/**
 * Real [TagChangeApplier] that writes a release's tag changes to disk through the single,
 * shared FLAC tag-write path ([FlacTagWriter]), supplied by story #817.
 *
 * This is the apply-side of the change-plan pipeline (#816). It looks up the album to resolve its
 * primary and merged directories, projects the [TagChange]s into a Vorbis field map, and delegates
 * to [FlacTagWriter] - the same collaborator used by manual retagging and Discogs sync, so all
 * three converge on one atomic write path (AC-E10).
 *
 * @param albumRepository Resolves the album's on-disk directories.
 * @param flacTagWriter The single FLAC tag-write collaborator.
 */
class FlacTagChangeApplier(
    private val albumRepository: AlbumRepository,
    private val flacTagWriter: FlacTagWriter,
) : TagChangeApplier {

    override suspend fun apply(albumId: Uuid, changes: List<TagChange>) {
        if (changes.isEmpty()) return

        val album = albumRepository.findById(albumId)
            ?: throw ResourceNotFoundException("Album", albumId.toString())

        // A null proposedValue means "remove the field". The current FLAC editor sets values; a
        // null proposal is skipped so a removal never writes an empty tag. Plans produced for RETAG
        // and DISCOGS_SYNC only carry additions/changes, so this is not exercised today, but the
        // guard keeps the applier honest if removals are ever planned.
        val fields = changes
            .mapNotNull { change -> change.proposedValue?.let { change.field to it } }
            .toMap()

        if (fields.isEmpty()) {
            logger.info { "tag_change_apply_noop albumId=$albumId reason=only_removals" }
            return
        }

        flacTagWriter.writeAlbumFields(
            albumId = albumId,
            primaryDir = Path.of(album.directoryPath),
            mergedDirs = album.mergedDirectories,
            fields = fields,
        )
        logger.info { "tag_change_apply_complete albumId=$albumId fieldCount=${fields.size}" }
    }
}
