import { Fragment, useCallback, useState } from 'react'
import { useNavigate, useParams, useBlocker } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { type Album, AlbumsService, type Track } from '../../api/generated'
import { useAlbum } from './useAlbum'
import { useAlbumTagSave } from './useAlbumTagSave'
import { ConfirmWriteDialog } from './confirm-write-dialog'
import { NavigationGuardDialog } from './navigation-guard-dialog'
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
   * Cleared after a successful batch Save or after a Discogs sync (which overwrites local edits).
   */
  const [dirtyFields, setDirtyFields] = useState<Record<string, string>>({})
  /** Error message from the most recent failed batch save, cleared on next Save attempt. */
  const [batchSaveError, setBatchSaveError] = useState<string | null>(null)
  /**
   * Navigation blocker: intercepts all React Router navigations (back button,
   * in-app links, browser history) when there are uncommitted dirty fields.
   * When blocked, the NavigationGuardDialog is shown; the user can confirm
   * (proceed and discard dirty changes) or cancel (stay on page).
   */
  const blocker = useBlocker(Object.keys(dirtyFields).length > 0)

  const handleNavGuardConfirm = useCallback(() => {
    if (blocker.state === 'blocked') {
      blocker.proceed()
    }
  }, [blocker])

  const handleNavGuardCancel = useCallback(() => {
    if (blocker.state === 'blocked') {
      blocker.reset()
    }
  }, [blocker])

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
   * Sentinel onSave passed to album-level EditableField instances.
   * Album fields use onCommit + batch Save; onSave is never called in normal usage
   * because EditableField only calls onSave when onCommit is absent.
   * This function exists only to satisfy the required onSave prop type.
   * Rejects immediately if somehow invoked so the bug is visible in tests and logs.
   */
  const handleAlbumTagSave = useCallback(
    // Parameters are intentionally unused: album fields commit via onCommit, not onSave.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_field: string, _value: string): Promise<void> => {
      const err = new Error('Album field onSave called unexpectedly - use onCommit')
      err.name = 'InternalSentinelError'
      return Promise.reject(err)
    },
    [],
  )

  /**
   * Opens the confirmation dialog for the batch save triggered by the Save button.
   * Clears any previous batch-save error so the user gets a clean retry attempt.
   */
  const handleSaveButtonClick = useCallback(() => {
    if (Object.keys(dirtyFields).length === 0) return
    setBatchSaveError(null)
    setConfirmOpen(true)
  }, [dirtyFields])

  /**
   * User clicked "Write tags" in the confirmation dialog.
   * Batch-saves all dirty album-level fields in sequence and clears them on success.
   */
  const handleConfirm = useCallback(async () => {
    setConfirmOpen(false)

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
      // Show the error message in the save row so the user knows what happened.
      const message = err instanceof Error ? err.message : t('common.error')
      setBatchSaveError(message)
    }
  }, [albumId, dirtyFields, saveTag, refetch, t])

  /**
   * User clicked "Cancel" or pressed Escape on the confirmation dialog.
   * Closes the dialog without applying any changes; dirty fields remain intact
   * so the user can retry the batch Save.
   */
  const handleCancel = useCallback(() => {
    setConfirmOpen(false)
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
    // Sync completed - Discogs data overwrites any local edits; clear dirty state so
    // the Save button does not re-apply stale values on top of the fresh sync result.
    setHasLocalEdits(false)
    setDirtyFields({})
    setBatchSaveError(null)
  }, [album, queryClient])

  if (loading) return <p>{t('albumDetail.loading')}</p>
  if (fetchError) return <p role="alert">{t('albumDetail.errorPrefix')}{fetchError.message}</p>
  if (!displayAlbum) return <p role="alert">{t('albumDetail.notFound')}</p>

  const dirtyCount = Object.keys(dirtyFields).length

  return (
    <>
      <ConfirmWriteDialog
        open={confirmOpen}
        albumTitle={displayAlbum.album}
        trackCount={displayAlbum.tracks.length}
        onConfirm={() => { void handleConfirm() }}
        onCancel={handleCancel}
      />
      <NavigationGuardDialog
        open={blocker.state === 'blocked'}
        onConfirm={handleNavGuardConfirm}
        onCancel={handleNavGuardCancel}
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
                disabled={dirtyCount === 0 || isSaving}
                data-testid="save-button"
                aria-label={
                  dirtyCount > 0
                    ? t('albumDetail.saveButtonLabel', { count: dirtyCount })
                    : t('albumDetail.saveButtonLabelClean')
                }
              >
                {isSaving ? t('albumDetail.saving') : t('albumDetail.saveButton')}
              </button>
              {dirtyCount > 0 && (
                <span className={styles.dirtyCount} data-testid="dirty-count">
                  {t('albumDetail.dirtyCount', { count: dirtyCount })}
                </span>
              )}
              {batchSaveError !== null && (
                <p
                  role="alert"
                  className={styles.batchSaveError}
                  data-testid="batch-save-error"
                >
                  {t('editableField.saveFailed')}: {batchSaveError}
                </p>
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
        {groups.map((group, groupIndex) => (
          // Use groupIndex as tiebreaker so Fragment keys are always unique even if
          // two non-consecutive null-disc groups end up in the list (edge case).
          <Fragment key={`${group.discLabel ?? 'no-disc'}-${groupIndex}`}>
            {isMultiDisc && group.discLabel !== null && (
              <tr className={styles.discHeader}>
                <td colSpan={5}>{t('albumDetail.discHeader', { number: group.discLabel })}</td>
              </tr>
            )}
            {group.tracks.map((track, trackIndex) => (
              // Use track.filePath as part of the key: each track maps to exactly one
              // file on disk, so filePath is a stable, unique identity for a track row.
              // The trackIndex tiebreaker guards against duplicate IDs from the backend
              // (which would otherwise cause React to reuse the same DOM node for every
              // row and display identical data for all tracks).
              <TrackRow
                key={`${track.filePath}-${trackIndex}`}
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
