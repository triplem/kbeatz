package org.javafreedom.kbeatz.catalog.domain.port

import kotlin.uuid.Uuid
import org.javafreedom.kbeatz.catalog.domain.model.SyncResult

/**
 * Port interface for metadata sync providers.
 *
 * Implementations fetch metadata from an external source (e.g. Discogs, MusicBrainz)
 * and apply it to the album identified by [albumId].
 *
 * Phase 1: exactly one active provider is configured at wiring time.
 * Multiple concurrent providers are out of scope until a second source is introduced.
 *
 * @see org.javafreedom.kbeatz.catalog.infrastructure.sync.DiscogsSyncService
 */
interface SyncProvider {

    /** Human-readable name of this provider (e.g. "discogs"). */
    val name: String

    /**
     * Syncs a single album from the external metadata source.
     *
     * @param albumId UUID of the album to sync.
     * @param downloadImages When true, attempts cover art download after tag writes.
     * @return [SyncResult] describing what was written and any non-fatal warnings.
     * @throws org.javafreedom.kbeatz.common.ResourceNotFoundException when the album does not exist.
     * @throws org.javafreedom.kbeatz.common.BusinessValidationException when the album is missing
     *   required metadata (e.g. no source ID).
     */
    suspend fun sync(albumId: Uuid, downloadImages: Boolean): SyncResult
}
