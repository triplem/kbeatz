import { useCallback, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlbumDetail as AlbumDetailModel, Album, AlbumsService, Track } from '../../api/generated'
import { CancelledByUserError } from './cancelled-by-user-error'
import { ConfirmWriteDialog } from './confirm-write-dialog'
import { EditableField } from './editable-field'
import { SyncPanel } from '../sync/sync-panel'
import { formatDate } from '../../lib/i18n'
import styles from './album-detail.module.css'

/**
 * AlbumDetail - shows all Vorbis Comment tag fields for a single album with inline editing.
 *
 * ## Album-level editable fields
 * ALBUM, ALBUMARTIST, DATE, GENRE, LABEL, CATALOGNUMBER, COMPOSER, CONDUCTOR, ENSEMBLE
 *
 * ## Track-level editable fields (per row)
 * TITLE, TRACKNUMBER, ARTIST
 *
 * ## Edit flow
 * - Click on any album-level field value - inline input pre-filled with current value
 * - Enter - confirmation dialog appears before the PATCH is fired
 * - Blur (click away) - silently cancels edit, restores original value; no dialog, no API call
 * - Confirm - PATCH /albums/{albumId}; optimistic update; rollback + error toast on failure
 * - Cancel / Escape on dialog - abort, keep the form in its edited state
 * - Escape on input - cancel edit, restore original value; no dialog shown; no API call
 *
 * ## Discogs sync
 * - SyncPanel is rendered below the tag fields when the album has a discogsId
 * - On sync complete the album state is updated with the returned Album
 */

/**
 * Pending album-level tag save that is awaiting user confirmation.
 *
 * When an EditableField triggers onSave we do NOT fire the PATCH immediately.
 * Instead we capture the intent here, show the confirmation dialog, and only
 * call the API once the user clicks "Write tags".
 */
interface PendingSave {
  readonly field: string
  readonly value: string
  /** resolve/reject from the Promise returned to EditableField so it can
   *  show errors or exit edit mode correctly */
  readonly resolve: () => void
  readonly reject: (err: unknown) => void
}

export function AlbumDetail() {
  const { albumId } = useParams<{ albumId: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  /** True after any album-level tag has been successfully saved since the last sync. */
  const [hasLocalEdits, setHasLocalEdits] = useState(false)
  const pendingSaveRef = useRef<PendingSave | null>(null)

  const {
    data: album,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ['album', albumId],
    queryFn: () => AlbumsService.getAlbum({ albumId: albumId! }),
    enabled: Boolean(albumId),
  })

  const updateAlbumTagsMutation = useMutation({
    mutationFn: ({ field, value }: { field: string; value: string }) =>
      AlbumsService.updateAlbumTags({
        albumId: albumId!,
        requestBody: { field, value },
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['album', albumId], updated)
      queryClient.invalidateQueries({ queryKey: ['albums'] })
    },
  })

  const updateTrackTagsMutation = useMutation({
    mutationFn: ({ trackId, field, value }: { trackId: string; field: string; value: string }) =>
      AlbumsService.updateTrackTags({
        albumId: albumId!,
        trackId,
        requestBody: { field, value },
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['album', albumId], updated)
    },
  })

  /**
   * Called by EditableField when the user commits an album-level field edit.
   *
   * Instead of firing the PATCH immediately, we capture the pending save and
   * open the confirmation dialog. The returned Promise resolves/rejects only
   * after the user has confirmed (or cancelled).
   */
  const handleAlbumTagSave = useCallback(
    (field: string, value: string): Promise<void> =>
      new Promise((resolve, reject) => {
        setIsSaving(true)
        pendingSaveRef.current = {
          field,
          value,
          resolve: () => { setIsSaving(false); resolve() },
          reject: (err: unknown) => { setIsSaving(false); reject(err) },
        }
        setConfirmOpen(true)
      }),
    [],
  )

  /**
   * User clicked "Write tags" in the confirmation dialog.
   * Fire the actual PATCH call via mutation, then resolve/reject the pending
   * promise so EditableField exits edit mode (or shows an error).
   */
  const handleConfirm = useCallback(async () => {
    const pending = pendingSaveRef.current
    if (!pending || !albumId) return

    setConfirmOpen(false)
    pendingSaveRef.current = null

    try {
      await updateAlbumTagsMutation.mutateAsync({ field: pending.field, value: pending.value })
      setHasLocalEdits(true)
      pending.resolve()
    } catch (err) {
      pending.reject(err)
    }
  }, [albumId, updateAlbumTagsMutation])

  /**
   * User clicked "Cancel" or pressed Escape.
   * Reject the pending promise so EditableField keeps its edited state
   * (the user's changes remain in the input - they are NOT reset).
   */
  const handleCancel = useCallback(() => {
    const pending = pendingSaveRef.current
    setConfirmOpen(false)
    pendingSaveRef.current = null
    // Reject with a sentinel so EditableField rolls back to original value
    // and shows no error (the user deliberately cancelled).
    pending?.reject(new CancelledByUserError())
  }, [])

  const handleTrackTagSave = useCallback(
    (trackId: string) =>
      async (field: string, value: string) => {
        if (!albumId) return
        await updateTrackTagsMutation.mutateAsync({ trackId, field, value })
      },
    [albumId, updateTrackTagsMutation],
  )

  const handleSyncComplete = useCallback((updated: Album) => {
    // Merge the sync result into the current album detail.
    // The sync API returns Album (not AlbumDetail), so we patch only the
    // fields that Album carries; tracks and hasCoverArt are preserved.
    queryClient.setQueryData<AlbumDetailModel>(['album', albumId], (prev) => {
      if (!prev) return prev
      return {
        ...prev,
        albumArtist: updated.albumArtist,
        album: updated.album,
        date: updated.date,
        genre: updated.genre,
        label: updated.label,
        catalogNumber: updated.catalogNumber,
        composer: updated.composer,
        conductor: updated.conductor,
        ensemble: updated.ensemble,
        discogsId: updated.discogsId,
        hasCoverArt: updated.hasCoverArt,
      }
    })
    // Also invalidate the album list so the grid reflects the updated metadata
    queryClient.invalidateQueries({ queryKey: ['albums'] })
    // Sync completed - local edits are now overwritten by Discogs data
    setHasLocalEdits(false)
  }, [albumId, queryClient])

  if (isPending) return <p>{t('albumDetail.loading')}</p>
  if (isError) return <p role="alert">{t('albumDetail.errorPrefix')}{' '}{error instanceof Error ? error.message : t('common.error')}</p>
  if (!album) return <p role="alert">{t('albumDetail.notFound')}</p>

  return (
    <>
      <ConfirmWriteDialog
        open={confirmOpen}
        albumTitle={album.album}
        trackCount={album.tracks.length}
        onConfirm={() => { void handleConfirm() }}
        onCancel={handleCancel}
      />
    <article className={styles.albumDetail} aria-label={t('albumDetail.albumTagsSection')}>
      <button
        type="button"
        onClick={() => { navigate(-1) }}
        className={styles.backButton}
        data-testid="back-button"
      >
        {t('common.back')}
      </button>

      {album.hasCoverArt && (
        <img
          src={`/api/v1/albums/${album.id}/cover`}
          alt={t('albumDetail.coverAlt', { album: album.album })}
          className={styles.albumCover}
          loading="lazy"
          data-testid="album-cover"
        />
      )}

      <section aria-label={t('albumDetail.albumTagsSection')}>
        <h2 className={styles.sectionTitle}>{t('albumDetail.sectionTitle')}</h2>
        {isSaving && (
          <p role="status" aria-live="polite" data-testid="album-saving-indicator">
            {t('albumDetail.saving')}
          </p>
        )}
        <p
          id="edit-scope-notice"
          className={styles.editScopeNotice}
          data-testid="edit-scope-notice"
        >
          {t('albumDetail.editScopeNotice', { count: album.tracks.length })}
        </p>
        <dl id="album-tags" className={styles.albumTags}>
          <EditableField
            label={t('albumDetail.fields.album')}
            value={album.album}
            fieldName="ALBUM"
            onSave={handleAlbumTagSave}
            testIdPrefix="album"
            disabled={isSaving}
            scopeDescribedBy="edit-scope-notice"
          />
          <EditableField
            label={t('albumDetail.fields.albumArtist')}
            value={album.albumArtist}
            fieldName="ALBUMARTIST"
            onSave={handleAlbumTagSave}
            testIdPrefix="album"
            disabled={isSaving}
            scopeDescribedBy="edit-scope-notice"
          />
          <EditableField
            label={t('albumDetail.fields.date')}
            value={album.date}
            displayValue={album.date !== undefined ? formatDate(album.date) : undefined}
            fieldName="DATE"
            onSave={handleAlbumTagSave}
            testIdPrefix="album"
            disabled={isSaving}
            scopeDescribedBy="edit-scope-notice"
          />
          <EditableField
            label={t('albumDetail.fields.genre')}
            value={album.genre}
            fieldName="GENRE"
            onSave={handleAlbumTagSave}
            testIdPrefix="album"
            disabled={isSaving}
            scopeDescribedBy="edit-scope-notice"
          />
          <EditableField
            label={t('albumDetail.fields.label')}
            value={album.label}
            fieldName="LABEL"
            onSave={handleAlbumTagSave}
            testIdPrefix="album"
            disabled={isSaving}
            scopeDescribedBy="edit-scope-notice"
          />
          <EditableField
            label={t('albumDetail.fields.catalogNumber')}
            value={album.catalogNumber}
            fieldName="CATALOGNUMBER"
            onSave={handleAlbumTagSave}
            testIdPrefix="album"
            disabled={isSaving}
            scopeDescribedBy="edit-scope-notice"
          />
          <EditableField
            label={t('albumDetail.fields.composer')}
            value={album.composer}
            fieldName="COMPOSER"
            onSave={handleAlbumTagSave}
            testIdPrefix="album"
            disabled={isSaving}
            scopeDescribedBy="edit-scope-notice"
          />
          <EditableField
            label={t('albumDetail.fields.conductor')}
            value={album.conductor}
            fieldName="CONDUCTOR"
            onSave={handleAlbumTagSave}
            testIdPrefix="album"
            disabled={isSaving}
            scopeDescribedBy="edit-scope-notice"
          />
          <EditableField
            label={t('albumDetail.fields.ensemble')}
            value={album.ensemble}
            fieldName="ENSEMBLE"
            onSave={handleAlbumTagSave}
            testIdPrefix="album"
            disabled={isSaving}
            scopeDescribedBy="edit-scope-notice"
          />
        </dl>
      </section>

      {album.discogsId !== undefined && (
        <section aria-label={t('albumDetail.discogsSection')}>
          <SyncPanel album={album} onSyncComplete={handleSyncComplete} hasLocalEdits={hasLocalEdits} />
        </section>
      )}

      {album.tracks.length > 0 && (
        <section aria-label={t('albumDetail.tracksSection')}>
          <h2 className={styles.sectionTitle}>{t('albumDetail.tracksSectionTitle')}</h2>
          <table className={styles.tracksTable} role="grid">
            <thead>
              <tr>
                <th scope="col">{t('albumDetail.trackColumns.number')}</th>
                <th scope="col">{t('albumDetail.trackColumns.title')}</th>
                <th scope="col">{t('albumDetail.trackColumns.artist')}</th>
                <th scope="col">{t('albumDetail.trackColumns.duration')}</th>
              </tr>
            </thead>
            <tbody>
              {album.tracks.map((track) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  onSave={handleTrackTagSave(track.id)}
                />
              ))}
            </tbody>
          </table>
        </section>
      )}
    </article>
    </>
  )
}

interface TrackRowProps {
  readonly track: Track
  readonly onSave: (field: string, value: string) => Promise<void>
}

function TrackRow({ track, onSave }: TrackRowProps) {
  const { t } = useTranslation()
  const durationDisplay = track.durationSeconds !== undefined
    ? formatDuration(track.durationSeconds)
    : '-'

  return (
    <tr data-testid={`track-row-${track.id}`}>
      <td>
        <EditableField
          label={t('albumDetail.fields.trackNumber')}
          value={track.trackNumber}
          fieldName="TRACKNUMBER"
          onSave={onSave}
          testIdPrefix={`track-${track.id}`}
        />
      </td>
      <td>
        <EditableField
          label={t('albumDetail.fields.title')}
          value={track.title}
          fieldName="TITLE"
          onSave={onSave}
          testIdPrefix={`track-${track.id}`}
        />
      </td>
      <td>
        <EditableField
          label={t('albumDetail.fields.artist')}
          value={track.artist}
          fieldName="ARTIST"
          onSave={onSave}
          testIdPrefix={`track-${track.id}`}
        />
      </td>
      <td>{durationDisplay}</td>
    </tr>
  )
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString()}:${secs.toString().padStart(2, '0')}`
}
