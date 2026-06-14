import { Fragment, useCallback, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { type Album, AlbumsService, type Track } from '../../api/generated'
import { useAlbum } from './useAlbum'
import { useAlbumTagSave } from './useAlbumTagSave'
import { CancelledByUserError } from './cancelled-by-user-error'
import { ConfirmWriteDialog } from './confirm-write-dialog'
import { EditableField } from './editable-field'
import { SyncPanel } from '../sync/sync-panel'
import { formatDate } from '../../lib/i18n'
import { formatTrackDuration } from '../../lib/format-duration'
import styles from './album-detail.module.css'

interface PathDisplayProps {
  readonly path: string
  readonly label: string
  readonly testId?: string
}

/**
 * Displays a filesystem path as read-only text with a Copy button.
 * Long paths are truncated with text-overflow: ellipsis.
 * The Copy button is always visible (not hover-only) so it works on touch and keyboard.
 */
function PathDisplay({ path, label, testId }: PathDisplayProps) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    if (!navigator.clipboard) {
      console.warn('Clipboard API unavailable - copy not supported in this context')
      return
    }
    navigator.clipboard.writeText(path).then(
      () => {
        setCopied(true)
        setTimeout(() => { setCopied(false) }, 1500)
      },
      (err: unknown) => {
        console.warn('Copy to clipboard failed:', err)
      },
    )
  }, [path])

  return (
    <span className={styles.pathDisplay} data-testid={testId}>
      <span className={styles.pathText} title={path}>{path}</span>
      <button
        type="button"
        className={styles.copyButton}
        onClick={handleCopy}
        aria-label={t('albumDetail.copyPath', { label })}
        data-testid={testId !== undefined ? `${testId}-copy` : undefined}
      >
        {copied ? t('albumDetail.copied') : t('albumDetail.copy')}
      </button>
    </span>
  )
}

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
 * Used by the batch Save flow: the confirmation dialog captures the full dirty-fields
 * map, then resolves this when all PATCHes succeed or rejects on the first failure.
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

  // Data fetching via custom hook
  const { data: album, isPending: loading, error: fetchError, refetch } = useAlbum(albumId)
  // Save mutation via custom hook
  const { save: saveTag, isPending: isSaving } = useAlbumTagSave(albumId)

  // Local UI state for the confirmation dialog flow
  const [confirmOpen, setConfirmOpen] = useState(false)
  /** True after any album-level tag has been successfully saved since the last sync. */
  const [hasLocalEdits, setHasLocalEdits] = useState(false)
  /**
   * A local copy of the album used for optimistic sync-complete updates.
   * When set, this overrides `album` from the query for rendering purposes.
   */
  const [syncedAlbum, setSyncedAlbum] = useState<typeof album>(undefined)
  /**
   * Accumulated dirty (pending) album-level tag changes not yet saved to the backend.
   * Keys are Vorbis Comment field names (e.g. "ALBUM", "ALBUMARTIST").
   * Values are the edited strings. Later commits for the same field overwrite earlier ones.
   * Cleared after a successful batch Save.
   */
  const [dirtyFields, setDirtyFields] = useState<Record<string, string>>({})
  const pendingSaveRef = useRef<PendingSave | null>(null)

  // Derive the displayed album - prefer synced state over query state
  const displayAlbum = syncedAlbum ?? album

  /**
   * Called by EditableField when the user presses Tab or Enter on an album-level field
   * (dirty-commit mode). Accumulates the change into dirtyFields without firing a network
   * request. The Save button becomes enabled when at least one dirty field exists.
   */
  const handleAlbumTagCommit = useCallback((field: string, value: string) => {
    setDirtyFields((prev) => ({ ...prev, [field]: value }))
  }, [])

  /**
   * Called by the Save button click. Shows the confirmation dialog; the dialog
   * confirmation triggers the actual batch PATCH sequence.
   * Also used as the onSave prop on album fields only as a fallback (e.g. if a field
   * is submitted via Enter without the onCommit path - this should not happen in
   * normal usage, but keeps the Promise contract intact).
   */
  const handleAlbumTagSave = useCallback(
    (field: string, value: string): Promise<void> =>
      new Promise((resolve, reject) => {
        pendingSaveRef.current = {
          field,
          value,
          resolve: () => { resolve() },
          reject: (err: unknown) => { reject(err) },
        }
        setConfirmOpen(true)
      }),
    [],
  )

  /**
   * Opens the confirmation dialog for the batch save triggered by the Save button.
   * The pending save ref is set to a sentinel that batch-saves all dirty fields.
   */
  const handleSaveButtonClick = useCallback(() => {
    if (Object.keys(dirtyFields).length === 0) return
    setConfirmOpen(true)
  }, [dirtyFields])

  /**
   * User clicked "Write tags" in the confirmation dialog.
   *
   * When triggered by the Save button (pendingSaveRef is null), batch-saves all dirty
   * fields in sequence and clears them on success.
   *
   * When triggered by a legacy single-field flow (pendingSaveRef is set), fires the
   * single PATCH and resolves/rejects the pending promise.
   */
  const handleConfirm = useCallback(async () => {
    const pending = pendingSaveRef.current
    setConfirmOpen(false)
    pendingSaveRef.current = null

    if (pending !== null) {
      // Legacy single-field path (track fields still use this)
      if (!albumId) return
      try {
        await saveTag({ field: pending.field, value: pending.value })
        setHasLocalEdits(true)
        setSyncedAlbum(undefined)
        pending.resolve()
      } catch (err) {
        pending.reject(err)
      }
      return
    }

    // Batch-save all dirty album-level fields
    if (!albumId) return
    const fields = Object.entries(dirtyFields)
    try {
      for (const [field, value] of fields) {
        await saveTag({ field, value })
      }
      setDirtyFields({})
      setHasLocalEdits(true)
      setSyncedAlbum(undefined)
      // Refetch so EditableField value props update and committedValue is cleared
      await refetch()
    } catch (err) {
      // On failure, keep dirty fields so the user can retry.
      // Show the error via the save mutation error state (handled by useAlbumTagSave).
      console.warn('Batch save failed:', err)
    }
  }, [albumId, dirtyFields, saveTag, refetch])

  /**
   * User clicked "Cancel" or pressed Escape on the confirmation dialog.
   * Reject the pending promise so EditableField keeps its edited state
   * (the user's changes remain in the input - they are NOT reset).
   * For the batch Save button flow (no pending ref), just close the dialog.
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
        await AlbumsService.updateTrackTags({
          albumId,
          trackId,
          requestBody: { field, value },
        })
        // Refetch to get updated track data
        await refetch()
      },
    [albumId, refetch],
  )

  const handleSyncComplete = useCallback((updated: Album) => {
    // Merge the sync result into the current album detail.
    // The sync API returns Album (not AlbumDetail), so we patch only the
    // fields that Album carries; tracks and hasCoverArt are preserved.
    setSyncedAlbum((prev) => {
      const base = prev ?? album
      if (!base) return base
      return {
        ...base,
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
    void queryClient.invalidateQueries({ queryKey: ['albums'] })
    // Sync completed - local edits are now overwritten by Discogs data
    setHasLocalEdits(false)
  }, [album, queryClient])

  if (loading) return <p>{t('albumDetail.loading')}</p>
  if (fetchError) return <p role="alert">{t('albumDetail.errorPrefix')}{fetchError.message}</p>
  if (!displayAlbum) return <p role="alert">{t('albumDetail.notFound')}</p>

  return (
    <>
      <ConfirmWriteDialog
        open={confirmOpen}
        albumTitle={displayAlbum.album}
        trackCount={displayAlbum.tracks.length}
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

      <div className={styles.twoColumnLayout} data-testid="two-column-layout">
        <div className={styles.metadataColumn} data-testid="metadata-column">
          {displayAlbum.hasCoverArt && (
            <img
              src={`/api/v1/albums/${displayAlbum.id}/cover`}
              alt={t('albumDetail.coverAlt', { album: displayAlbum.album })}
              className={styles.albumCover}
              loading="lazy"
              data-testid="album-cover"
            />
          )}

          <section aria-labelledby="album-tags-heading">
            <h2 id="album-tags-heading" className={styles.sectionTitle}>{t('albumDetail.sectionTitle')}</h2>
            {isSaving && (
              <p role="status" aria-live="polite" data-testid="album-saving-indicator">
                {t('albumDetail.saving')}
              </p>
            )}
            <div className={styles.albumPathRow}>
              <span className={styles.albumPathLabel}>{t('albumDetail.fields.albumPath')}</span>
              <PathDisplay
                path={displayAlbum.albumPath}
                label={t('albumDetail.fields.albumPath')}
                testId="album-path"
              />
            </div>
            <p
              id="edit-scope-notice"
              className={styles.editScopeNotice}
              data-testid="edit-scope-notice"
            >
              {t('albumDetail.editScopeNotice', { count: displayAlbum.tracks.length })}
            </p>
            <dl id="album-tags" className={styles.albumTags}>
              <EditableField
                label={t('albumDetail.fields.album')}
                value={displayAlbum.album}
                fieldName="ALBUM"
                onSave={handleAlbumTagSave}
                onCommit={handleAlbumTagCommit}
                testIdPrefix="album"
                disabled={isSaving}
                scopeDescribedBy="edit-scope-notice"
              />
              <EditableField
                label={t('albumDetail.fields.albumArtist')}
                value={displayAlbum.albumArtist}
                fieldName="ALBUMARTIST"
                onSave={handleAlbumTagSave}
                onCommit={handleAlbumTagCommit}
                testIdPrefix="album"
                disabled={isSaving}
                scopeDescribedBy="edit-scope-notice"
              />
              <EditableField
                label={t('albumDetail.fields.date')}
                value={displayAlbum.date}
                displayValue={displayAlbum.date !== undefined ? formatDate(displayAlbum.date) : undefined}
                fieldName="DATE"
                onSave={handleAlbumTagSave}
                onCommit={handleAlbumTagCommit}
                testIdPrefix="album"
                disabled={isSaving}
                scopeDescribedBy="edit-scope-notice"
              />
              <EditableField
                label={t('albumDetail.fields.genre')}
                value={displayAlbum.genre}
                fieldName="GENRE"
                onSave={handleAlbumTagSave}
                onCommit={handleAlbumTagCommit}
                testIdPrefix="album"
                disabled={isSaving}
                scopeDescribedBy="edit-scope-notice"
              />
              <EditableField
                label={t('albumDetail.fields.label')}
                value={displayAlbum.label}
                fieldName="LABEL"
                onSave={handleAlbumTagSave}
                onCommit={handleAlbumTagCommit}
                testIdPrefix="album"
                disabled={isSaving}
                scopeDescribedBy="edit-scope-notice"
              />
              <EditableField
                label={t('albumDetail.fields.catalogNumber')}
                value={displayAlbum.catalogNumber}
                fieldName="CATALOGNUMBER"
                onSave={handleAlbumTagSave}
                onCommit={handleAlbumTagCommit}
                testIdPrefix="album"
                disabled={isSaving}
                scopeDescribedBy="edit-scope-notice"
              />
              <EditableField
                label={t('albumDetail.fields.composer')}
                value={displayAlbum.composer}
                fieldName="COMPOSER"
                onSave={handleAlbumTagSave}
                onCommit={handleAlbumTagCommit}
                testIdPrefix="album"
                disabled={isSaving}
                scopeDescribedBy="edit-scope-notice"
              />
              <EditableField
                label={t('albumDetail.fields.conductor')}
                value={displayAlbum.conductor}
                fieldName="CONDUCTOR"
                onSave={handleAlbumTagSave}
                onCommit={handleAlbumTagCommit}
                testIdPrefix="album"
                disabled={isSaving}
                scopeDescribedBy="edit-scope-notice"
              />
              <EditableField
                label={t('albumDetail.fields.ensemble')}
                value={displayAlbum.ensemble}
                fieldName="ENSEMBLE"
                onSave={handleAlbumTagSave}
                onCommit={handleAlbumTagCommit}
                testIdPrefix="album"
                disabled={isSaving}
                scopeDescribedBy="edit-scope-notice"
              />
            </dl>
            <div className={styles.saveRow}>
              <button
                type="button"
                className={styles.saveButton}
                onClick={handleSaveButtonClick}
                disabled={Object.keys(dirtyFields).length === 0 || isSaving}
                data-testid="save-button"
                aria-label={
                  Object.keys(dirtyFields).length > 0
                    ? t('albumDetail.saveButtonLabel', { count: Object.keys(dirtyFields).length })
                    : t('albumDetail.saveButtonLabelClean')
                }
              >
                {isSaving ? t('albumDetail.saving') : t('albumDetail.saveButton')}
              </button>
              {Object.keys(dirtyFields).length > 0 && (
                <span className={styles.dirtyCount} data-testid="dirty-count">
                  {t('albumDetail.dirtyCount', { count: Object.keys(dirtyFields).length })}
                </span>
              )}
            </div>
          </section>

          {displayAlbum.discogsId !== undefined && (
            <section aria-label={t('albumDetail.discogsSection')}>
              <SyncPanel album={displayAlbum} onSyncComplete={handleSyncComplete} hasLocalEdits={hasLocalEdits} />
            </section>
          )}
        </div>

        <div className={styles.tracklistColumn} data-testid="tracklist-column">
          <section aria-label={t('albumDetail.tracksSection')}>
            <h2 className={styles.sectionTitle}>{t('albumDetail.tracksSectionTitle')}</h2>
            {displayAlbum.tracks.length === 0
              ? <p className={styles.noTracks}>{t('albumDetail.noTracks')}</p>
              : (
                <TrackList
                  tracks={displayAlbum.tracks}
                  onSave={handleTrackTagSave}
                />
              )
            }
          </section>
        </div>
      </div>
    </article>
    </>
  )
}

interface TrackListProps {
  readonly tracks: Track[]
  readonly onSave: (trackId: string) => (field: string, value: string) => Promise<void>
}

/**
 * Renders the full tracklist, sorted by disc number then track position.
 * Multi-disc albums are grouped with a "Disc N" header row between groups.
 */
function TrackList({ tracks, onSave }: TrackListProps) {
  const { t } = useTranslation()

  // Sort tracks by disc number (numeric prefix), then by track number (numeric prefix).
  // Non-numeric values sort lexicographically after numeric ones.
  const sorted = [...tracks].sort((a, b) => {
    const discA = parseLeadingInt(a.discNumber)
    const discB = parseLeadingInt(b.discNumber)
    if (discA !== discB) return discA - discB
    return parseLeadingInt(a.trackNumber) - parseLeadingInt(b.trackNumber)
  })

  // Determine whether any track has a disc number - if so, render disc headers.
  const isMultiDisc = sorted.some((t) => t.discNumber !== undefined && t.discNumber !== null && t.discNumber !== '')

  // Group by disc number for multi-disc rendering.
  const groups: { discLabel: string | null; tracks: Track[] }[] = []
  for (const track of sorted) {
    const discKey = track.discNumber ?? null
    const last = groups[groups.length - 1]
    if (last !== undefined && last.discLabel === discKey) {
      last.tracks.push(track)
    } else {
      groups.push({ discLabel: discKey, tracks: [track] })
    }
  }

  return (
    <table className={styles.tracksTable} role="grid">
      <thead>
        <tr>
          <th scope="col">{t('albumDetail.trackColumns.position')}</th>
          <th scope="col">{t('albumDetail.trackColumns.title')}</th>
          <th scope="col">{t('albumDetail.trackColumns.artist')}</th>
          <th scope="col">{t('albumDetail.trackColumns.duration')}</th>
          <th scope="col">{t('albumDetail.trackColumns.file')}</th>
        </tr>
      </thead>
      <tbody>
        {groups.map((group) => (
          <Fragment key={group.discLabel ?? 'no-disc'}>
            {isMultiDisc && group.discLabel !== null && (
              <tr className={styles.discHeader}>
                <td colSpan={5}>{t('albumDetail.discHeader', { number: group.discLabel })}</td>
              </tr>
            )}
            {group.tracks.map((track) => (
              <TrackRow
                key={track.id}
                track={track}
                onSave={onSave(track.id)}
              />
            ))}
          </Fragment>
        ))}
      </tbody>
    </table>
  )
}

interface TrackRowProps {
  readonly track: Track
  readonly onSave: (field: string, value: string) => Promise<void>
}

function TrackRow({ track, onSave }: TrackRowProps) {
  const { t } = useTranslation()
  const durationDisplay = track.durationSeconds !== undefined
    ? formatTrackDuration(track.durationSeconds)
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
      <td>
        <PathDisplay
          path={track.filePath}
          label={t('albumDetail.trackColumns.file')}
          testId={`track-${track.id}-file-path`}
        />
      </td>
    </tr>
  )
}

/** Parse the leading integer from a string like "1", "2", "A1". Returns Infinity for null/empty. */
function parseLeadingInt(value: string | null | undefined): number {
  if (value === undefined || value === null || value === '') return Infinity
  const match = /^(\d+)/.exec(value)
  return match !== null && match[1] !== undefined ? parseInt(match[1], 10) : Infinity
}
