import { Fragment, useCallback, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Popover, { type PopoverOrigin } from '@mui/material/Popover'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CancelIcon from '@mui/icons-material/Cancel'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { visuallyHidden } from '@mui/utils'
import { type Album, type AlbumDetail as AlbumDetailModel, AlbumsService, type Track } from '../../api/generated'
import { ApiError } from '../../api/generated/core/ApiError'
import { logger } from '../../lib/logger'
import { ConfirmWriteDialog } from './confirm-write-dialog'
import { NavigationGuardDialog } from './navigation-guard-dialog'
import { EditableField } from './editable-field'
import { useUnsavedChangesBlocker } from '../../shell/use-unsaved-changes-blocker'
import { SyncPanel } from '../sync/sync-panel'
import { formatDate } from '../../lib/i18n'
import { formatTrackDuration } from '../../lib/format-duration'
import { AlbumHeroHeader } from './album-hero-header'

/** Album-level Vorbis Comment fields rendered as editable rows, in display order. */
const ALBUM_FIELDS: ReadonlyArray<{ key: keyof AlbumDetailModel; labelKey: string; fieldName: string }> = [
  { key: 'album', labelKey: 'album', fieldName: 'ALBUM' },
  { key: 'albumArtist', labelKey: 'albumArtist', fieldName: 'ALBUMARTIST' },
  { key: 'date', labelKey: 'date', fieldName: 'DATE' },
  { key: 'genre', labelKey: 'genre', fieldName: 'GENRE' },
  { key: 'label', labelKey: 'label', fieldName: 'LABEL' },
  { key: 'catalogNumber', labelKey: 'catalogNumber', fieldName: 'CATALOGNUMBER' },
  { key: 'composer', labelKey: 'composer', fieldName: 'COMPOSER' },
  { key: 'conductor', labelKey: 'conductor', fieldName: 'CONDUCTOR' },
  { key: 'ensemble', labelKey: 'ensemble', fieldName: 'ENSEMBLE' },
]

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
    <Box
      component="span"
      data-testid={testId}
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, minWidth: 0, maxWidth: '100%' }}
    >
      <Box
        component="span"
        title={path}
        sx={{
          fontFamily: 'monospace',
          fontSize: '0.8125rem',
          color: 'text.primary',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 0,
        }}
      >
        {path}
      </Box>
      <Button
        type="button"
        size="small"
        variant="outlined"
        onClick={handleCopy}
        aria-label={t('albumDetail.copyPath', { label })}
        data-testid={testId !== undefined ? `${testId}-copy` : undefined}
        sx={{ flexShrink: 0, minHeight: 44, minWidth: 44, px: 1, fontSize: '0.75rem' }}
      >
        {copied ? t('albumDetail.copied') : t('albumDetail.copy')}
      </Button>
    </Box>
  )
}

export interface AlbumDetailEditProps {
  /** Album data to display in the edit form. */
  readonly album: AlbumDetailModel
  /** Called when the user cancels without dirty changes or confirms the cancel guard dialog. */
  readonly onExitEditMode: () => void
  /** Called when a Discogs sync completes with the updated album data. */
  readonly onSyncComplete: (updated: Album) => void
  /** True after any album-level tag has been successfully saved since the last sync. */
  readonly hasLocalEdits: boolean
  /** Ref attached to the Cancel button for focus management. */
  readonly cancelButtonRef: React.RefObject<HTMLButtonElement | null>
}

/**
 * AlbumDetailEdit - full edit layout with all Vorbis Comment tag fields.
 *
 * Extracted from the original AlbumDetail monolith. Owns:
 * - dirtyFields, dirtyTrackFields: pending unsaved changes
 * - isSaving: PATCH in flight
 * - confirmOpen: ConfirmWriteDialog state
 * - batchSaveError: last failed save message
 * - cancelGuardOpen: in-component guard for Cancel-with-dirty
 *
 * Does NOT own: isEditMode, syncedAlbum (those belong to AlbumDetail wrapper).
 */
export function AlbumDetailEdit({
  album,
  onExitEditMode,
  onSyncComplete,
  hasLocalEdits,
  cancelButtonRef,
}: AlbumDetailEditProps) {
  const { albumId } = useParams<{ albumId: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  /** True while the bulk PATCH request is in flight; disables all edit fields during save. */
  const [isSaving, setIsSaving] = useState(false)

  // Local UI state for the confirmation dialog flow
  const [confirmOpen, setConfirmOpen] = useState(false)

  /**
   * Accumulated dirty (pending) album-level tag changes not yet saved to the backend.
   * Keys are Vorbis Comment field names (e.g. "ALBUM", "ALBUMARTIST").
   * Values are the edited strings. Later commits for the same field overwrite earlier ones.
   * Cleared after a successful batch Save or after a Discogs sync.
   */
  const [dirtyFields, setDirtyFields] = useState<Record<string, string>>({})

  /**
   * Accumulated dirty (pending) track-level tag changes not yet saved to the backend.
   * Outer key is the track id; inner key is the Vorbis Comment field name (e.g. "TITLE").
   * Later commits for the same track+field overwrite earlier ones.
   * Cleared after a successful batch Save or after a Discogs sync.
   */
  const [dirtyTrackFields, setDirtyTrackFields] = useState<Record<string, Record<string, string>>>({})

  /** Error message from the most recent failed batch save, cleared on next Save attempt. */
  const [batchSaveError, setBatchSaveError] = useState<string | null>(null)

  /** True when the user clicked Cancel with dirty fields - shows the in-component guard. */
  const [cancelGuardOpen, setCancelGuardOpen] = useState(false)

  const hasAnyDirty = Object.keys(dirtyFields).length > 0 || Object.keys(dirtyTrackFields).length > 0

  /**
   * Navigation blocker: intercepts all React Router navigations (back button,
   * in-app links, browser history) when there are uncommitted dirty fields.
   * When blocked, the NavigationGuardDialog (router variant) is shown.
   */
  const blocker = useUnsavedChangesBlocker(hasAnyDirty)

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
    if (!hasAnyDirty) return
    setBatchSaveError(null)
    setConfirmOpen(true)
  }, [hasAnyDirty])

  /**
   * User clicked "Write tags" in the confirmation dialog.
   * Sends all dirty album-level and track-level fields in a single bulk PATCH request.
   * Clears both dirty states on success.
   */
  const handleConfirm = useCallback(async () => {
    setConfirmOpen(false)

    if (!albumId) return

    // Build the bulk request: album fields first, then track fields
    const albumFields = Object.entries(dirtyFields).map(([field, value]) => ({ field, value }))
    const trackFields = Object.entries(dirtyTrackFields).flatMap(([trackId, fields]) =>
      Object.entries(fields).map(([field, value]) => ({ trackId, field, value }))
    )

    setIsSaving(true)
    try {
      await AlbumsService.bulkUpdateAlbumTags({
        albumId,
        requestBody: { albumFields, trackFields },
      })
      setDirtyFields({})
      setDirtyTrackFields({})
      // Invalidate so grid reflects updated metadata
      void queryClient.invalidateQueries({ queryKey: ['albums'] })
    } catch (err) {
      // On failure, keep dirty fields so the user can retry.
      const apiErr = err instanceof ApiError ? err : null
      const serverCode = typeof apiErr?.body === 'object' && apiErr.body !== null
        ? (apiErr.body as Record<string, unknown>)['code']
        : undefined
      const serverMessage = typeof apiErr?.body === 'object' && apiErr.body !== null
        ? (apiErr.body as Record<string, unknown>)['message']
        : undefined
      logger.error(
        {
          err: err instanceof Error ? err.message : String(err),
          albumId,
          serverCode,
          serverMessage,
        },
        'batch_save_failed',
      )
      if (typeof serverCode === 'string' && typeof serverMessage === 'string') {
        setBatchSaveError(`${serverCode} - ${serverMessage}`)
      } else {
        setBatchSaveError(t('common.error'))
      }
    } finally {
      setIsSaving(false)
    }
  }, [albumId, dirtyFields, dirtyTrackFields, queryClient, t])

  /**
   * User clicked "Cancel" or pressed Escape on the ConfirmWriteDialog.
   * Closes the dialog without applying any changes; dirty fields remain intact.
   */
  const handleConfirmDialogCancel = useCallback(() => {
    setConfirmOpen(false)
  }, [])

  /**
   * User clicked the Cancel button (top of edit form).
   * - If no dirty fields: exit edit mode immediately.
   * - If dirty fields: show the in-component NavigationGuardDialog.
   */
  const handleCancelClick = useCallback(() => {
    if (!hasAnyDirty) {
      onExitEditMode()
      return
    }
    setCancelGuardOpen(true)
  }, [hasAnyDirty, onExitEditMode])

  /** User confirmed the cancel guard - discard dirty state and exit edit mode. */
  const handleCancelGuardConfirm = useCallback(() => {
    setCancelGuardOpen(false)
    setDirtyFields({})
    setDirtyTrackFields({})
    setBatchSaveError(null)
    onExitEditMode()
  }, [onExitEditMode])

  /** User cancelled the cancel guard - stay in edit mode with dirty fields intact. */
  const handleCancelGuardCancel = useCallback(() => {
    setCancelGuardOpen(false)
  }, [])

  /**
   * Called by track-level EditableField instances when the user presses Tab or Enter.
   * Accumulates the change into dirtyTrackFields without firing a network request.
   */
  const handleTrackFieldCommit = useCallback(
    (trackId: string) =>
      (field: string, value: string) => {
        setDirtyTrackFields((prev) => ({
          ...prev,
          [trackId]: { ...(prev[trackId] ?? {}), [field]: value },
        }))
      },
    [],
  )

  /**
   * Sentinel onSave passed to track-level EditableField instances.
   * Track fields use onCommit + batch Save; onSave is never called in normal usage.
   * Rejects immediately if somehow invoked so the bug is visible in tests and logs.
   */
  const handleTrackTagSaveSentinel = useCallback(
    // Parameters are intentionally unused: track fields commit via onCommit, not onSave.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_trackId: string) =>
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      (_field: string, _value: string): Promise<void> => {
        const err = new Error('Track field onSave called unexpectedly - use onCommit')
        err.name = 'InternalSentinelError'
        return Promise.reject(err)
      },
    [],
  )

  const handleSyncCompleteInternal = useCallback((updated: Album) => {
    // Sync completed - Discogs data overwrites any local edits; clear dirty state so
    // the Save button does not re-apply stale values on top of the fresh sync result.
    setDirtyFields({})
    setDirtyTrackFields({})
    setBatchSaveError(null)
    onSyncComplete(updated)
  }, [onSyncComplete])

  // Total dirty count = album fields + unique track fields across all tracks
  const albumDirtyCount = Object.keys(dirtyFields).length
  const trackDirtyCount = Object.values(dirtyTrackFields).reduce(
    (sum, fields) => sum + Object.keys(fields).length,
    0,
  )
  const dirtyCount = albumDirtyCount + trackDirtyCount

  return (
    <>
      <ConfirmWriteDialog
        open={confirmOpen}
        albumTitle={album.album}
        trackCount={album.tracks.length}
        onConfirm={() => { void handleConfirm() }}
        onCancel={handleConfirmDialogCancel}
      />
      {/* Router navigation guard - fires when user uses browser Back with dirty fields */}
      <NavigationGuardDialog
        open={blocker.state === 'blocked'}
        onConfirm={handleNavGuardConfirm}
        onCancel={handleNavGuardCancel}
      />
      {/* In-component cancel guard - fires when user clicks Cancel with dirty fields */}
      <NavigationGuardDialog
        open={cancelGuardOpen}
        onConfirm={handleCancelGuardConfirm}
        onCancel={handleCancelGuardCancel}
      />
      <Box
        component="article"
        aria-label={t('albumDetail.albumTagsSection')}
        sx={{
          maxWidth: 1200,
          mx: 'auto',
          p: { xs: 2, md: 3 },
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}
      >
        {/*
          Visually-hidden page heading: the album is the subject of this route,
          so it is exposed as the single <h1> to anchor the heading outline
          (WCAG 1.3.1 / 2.4.6). Section titles below render as <h2>/<h3>.
        */}
        <Typography variant="h1" component="h1" sx={visuallyHidden}>
          {album.album}
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            type="button"
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => { navigate(-1) }}
            data-testid="back-button"
            sx={{ alignSelf: 'flex-start', minHeight: 44 }}
          >
            {t('common.back')}
          </Button>

          <Button
            ref={cancelButtonRef}
            type="button"
            variant="outlined"
            color="secondary"
            startIcon={<CancelIcon />}
            onClick={handleCancelClick}
            data-testid="cancel-edit-button"
            sx={{ alignSelf: 'flex-start', minHeight: 44 }}
          >
            {t('albumDetail.cancelButton')}
          </Button>
        </Box>

        <AlbumHeroHeader album={album} />

        <Box
          data-testid="two-column-layout"
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '35fr 65fr' },
            alignItems: { lg: 'start' },
            gap: 3,
          }}
        >
          <Box
            data-testid="metadata-column"
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              position: { lg: 'sticky' },
              top: { lg: 64 },
              alignSelf: { lg: 'start' },
            }}
          >
            {album.hasCoverArt && (
              <Box
                component="img"
                src={`/api/v1/albums/${album.id}/cover`}
                alt={t('albumDetail.coverAlt', { album: album.album })}
                loading="lazy"
                data-testid="album-cover"
                sx={{
                  width: '100%',
                  maxWidth: 320,
                  aspectRatio: '1 / 1',
                  objectFit: 'cover',
                  borderRadius: 2,
                  boxShadow: 3,
                }}
              />
            )}

            <Box component="section" aria-labelledby="album-tags-heading">
              <Typography id="album-tags-heading" variant="h6" component="h2" sx={{ mb: 2 }}>
                {t('albumDetail.sectionTitle')}
              </Typography>
              {isSaving && (
                <Typography
                  role="status"
                  aria-live="polite"
                  component="p"
                  variant="body2"
                  color="text.secondary"
                  data-testid="album-saving-indicator"
                  sx={{ mb: 1 }}
                >
                  {t('albumDetail.saving')}
                </Typography>
              )}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500, flexShrink: 0 }}>
                  {t('albumDetail.fields.albumPath')}
                </Typography>
                <PathDisplay
                  path={album.albumPath}
                  label={t('albumDetail.fields.albumPath')}
                  testId="album-path"
                />
              </Box>
              <Typography
                id="edit-scope-notice"
                data-testid="edit-scope-notice"
                component="p"
                variant="body2"
                color="text.secondary"
                sx={{ mb: 1 }}
              >
                {t('albumDetail.editScopeNotice', { count: album.tracks.length })}
              </Typography>
              <Box
                component="dl"
                id="album-tags"
                sx={{
                  m: 0,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}
              >
                {ALBUM_FIELDS.map(({ key, labelKey, fieldName }) => {
                  const rawValue = album[key] as string | undefined
                  return (
                    <EditableField
                      key={fieldName}
                      label={t(`albumDetail.fields.${labelKey}`)}
                      value={rawValue}
                      displayValue={
                        key === 'date' && rawValue !== undefined ? formatDate(rawValue) : undefined
                      }
                      fieldName={fieldName}
                      onSave={handleAlbumTagSave}
                      onCommit={handleAlbumTagCommit}
                      testIdPrefix="album"
                      disabled={isSaving}
                      scopeDescribedBy="edit-scope-notice"
                    />
                  )
                })}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mt: 2 }}>
                <Button
                  type="button"
                  variant="contained"
                  onClick={handleSaveButtonClick}
                  disabled={!hasAnyDirty || isSaving}
                  data-testid="save-button"
                  aria-label={
                    dirtyCount > 0
                      ? t('albumDetail.saveButtonLabel', { count: dirtyCount })
                      : t('albumDetail.saveButtonLabelClean')
                  }
                  sx={{ minHeight: 44 }}
                >
                  {isSaving ? t('albumDetail.saving') : t('albumDetail.saveButton')}
                </Button>
                {dirtyCount > 0 && (
                  <Typography
                    component="span"
                    variant="body2"
                    color="text.secondary"
                    data-testid="dirty-count"
                  >
                    {t('albumDetail.dirtyCount', { count: dirtyCount })}
                  </Typography>
                )}
                {batchSaveError !== null && (
                  <Typography
                    role="alert"
                    component="p"
                    variant="body2"
                    color="error"
                    data-testid="batch-save-error"
                    sx={{ m: 0, width: '100%' }}
                  >
                    {t('editableField.saveFailed')}: {batchSaveError}
                  </Typography>
                )}
              </Box>
            </Box>

            <OtherTagsSection />

            {album.discogsId !== undefined && (
              <Box component="section" aria-label={t('albumDetail.discogsSection')}>
                <SyncPanel album={album} onSyncComplete={handleSyncCompleteInternal} hasLocalEdits={hasLocalEdits} />
              </Box>
            )}
          </Box>

          <Box data-testid="tracklist-column" sx={{ minWidth: 0 }}>
            <Box component="section" aria-label={t('albumDetail.tracksSection')}>
              <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
                {t('albumDetail.tracksSectionTitle')}
              </Typography>
              {album.tracks.length === 0
                ? (
                  <Typography component="p" variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    {t('albumDetail.noTracks')}
                  </Typography>
                )
                : (
                  <TrackList
                    tracks={album.tracks}
                    albumArtist={album.albumArtist}
                    onSave={handleTrackTagSaveSentinel}
                    onCommit={handleTrackFieldCommit}
                    disabled={isSaving}
                  />
                )}
            </Box>
          </Box>
        </Box>
      </Box>
    </>
  )
}

/**
 * OtherTagsSection - read-only list of non-standard Vorbis Comments.
 *
 * The catalog v1 API does not yet expose a non-standard tag map on AlbumDetail,
 * so this renders the section heading, a read-only notice, and an empty state.
 * It is intentionally non-editable in v1 (master FR-08).
 */
function OtherTagsSection() {
  const { t } = useTranslation()
  return (
    <Box component="section" aria-label={t('albumDetail.otherTagsSection')} data-testid="other-tags-section">
      <Typography variant="subtitle1" component="h2" sx={{ mb: 0.5 }}>
        {t('albumDetail.otherTagsTitle')}
      </Typography>
      <Typography component="p" variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        {t('albumDetail.otherTagsDescription')}
      </Typography>
      <Typography component="p" variant="body2" color="text.secondary" data-testid="other-tags-empty">
        {t('albumDetail.otherTagsEmpty')}
      </Typography>
    </Box>
  )
}

interface TrackListProps {
  readonly tracks: Track[]
  readonly albumArtist: string | undefined
  readonly onSave: (trackId: string) => (field: string, value: string) => Promise<void>
  readonly onCommit: (trackId: string) => (field: string, value: string) => void
  /** When true, all track fields are in read-only mode (e.g. during a batch save in flight). */
  readonly disabled?: boolean
}

/**
 * Renders the full tracklist, sorted by disc number then track position.
 * Multi-disc albums are grouped with a "Disc N" header row between groups.
 */
function TrackList({ tracks, albumArtist, onSave, onCommit, disabled = false }: TrackListProps) {
  const { t } = useTranslation()

  // Sort tracks by disc number (numeric prefix), then by track number (numeric prefix).
  const sorted = [...tracks].sort((a, b) => {
    const discA = parseLeadingInt(a.discNumber)
    const discB = parseLeadingInt(b.discNumber)
    if (discA !== discB) return discA - discB
    return parseLeadingInt(a.trackNumber) - parseLeadingInt(b.trackNumber)
  })

  // Determine whether any track has a disc number - if so, render disc headers.
  const isMultiDisc = sorted.some((tr) => tr.discNumber !== undefined && tr.discNumber !== null && tr.discNumber !== '')

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
    <TableContainer>
      <Table size="small" aria-label={t('albumDetail.tracksSectionTitle')}>
        <TableHead>
          <TableRow>
            <TableCell scope="col">{t('albumDetail.trackColumns.position')}</TableCell>
            <TableCell scope="col">{t('albumDetail.trackColumns.title')}</TableCell>
            <TableCell scope="col">{t('albumDetail.trackColumns.artist')}</TableCell>
            <TableCell scope="col">{t('albumDetail.trackColumns.duration')}</TableCell>
            <TableCell scope="col" aria-label={t('albumDetail.trackColumns.actions')} />
          </TableRow>
        </TableHead>
        <TableBody>
          {groups.map((group, groupIndex) => (
            <Fragment key={`${group.discLabel ?? 'no-disc'}-${groupIndex}`}>
              {isMultiDisc && group.discLabel !== null && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    sx={{ fontWeight: 600, color: 'text.secondary', bgcolor: 'action.hover' }}
                  >
                    {t('albumDetail.discHeader', { number: group.discLabel })}
                  </TableCell>
                </TableRow>
              )}
              {group.tracks.map((track, trackIndex) => (
                <TrackRow
                  key={`${track.filePath}-${trackIndex}`}
                  track={track}
                  albumArtist={albumArtist}
                  onSave={onSave(track.id)}
                  onCommit={onCommit(track.id)}
                  disabled={disabled}
                />
              ))}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

/** Popover anchor/transform origin for the file path popover. */
const FILE_POPOVER_ANCHOR_ORIGIN: PopoverOrigin = { vertical: 'bottom', horizontal: 'right' }
const FILE_POPOVER_TRANSFORM_ORIGIN: PopoverOrigin = { vertical: 'top', horizontal: 'right' }

interface TrackRowProps {
  readonly track: Track
  /** Album-level artist used to detect when a track has a different composer/artist attribution. */
  readonly albumArtist: string | undefined
  readonly onSave: (field: string, value: string) => Promise<void>
  readonly onCommit: (field: string, value: string) => void
  /** When true, all track fields are in read-only mode. */
  readonly disabled?: boolean
}

function TrackRow({ track, albumArtist, onSave, onCommit, disabled = false }: TrackRowProps) {
  const { t } = useTranslation()
  const durationDisplay = track.durationSeconds !== undefined
    ? formatTrackDuration(track.durationSeconds)
    : '-'

  /**
   * Classical attribution: when a track has a different artist from the album artist,
   * show "Artist - Title" in the title cell (read-only display only).
   */
  const titleAttributionDisplay =
    track.artist !== undefined && track.artist !== albumArtist && track.title !== undefined
      ? `${track.artist} - ${track.title}`
      : undefined

  const [popoverAnchor, setPopoverAnchor] = useState<HTMLButtonElement | null>(null)
  const popoverOpen = Boolean(popoverAnchor)
  const popoverId = popoverOpen ? `track-${track.id}-file-popover` : undefined

  const handleInfoClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    setPopoverAnchor(event.currentTarget)
  }, [])

  const handlePopoverClose = useCallback(() => {
    setPopoverAnchor(null)
  }, [])

  return (
    <TableRow data-testid={`track-row-${track.id}`} hover>
      <TableCell sx={{ verticalAlign: 'middle' }}>
        <EditableField
          label={t('albumDetail.fields.trackNumber')}
          value={track.trackNumber}
          fieldName="TRACKNUMBER"
          onSave={onSave}
          onCommit={onCommit}
          disabled={disabled}
          testIdPrefix={`track-${track.id}`}
          variant="cell"
        />
      </TableCell>
      <TableCell sx={{ verticalAlign: 'middle' }}>
        <EditableField
          label={t('albumDetail.fields.title')}
          value={track.title}
          displayValue={titleAttributionDisplay}
          fieldName="TITLE"
          onSave={onSave}
          onCommit={onCommit}
          disabled={disabled}
          testIdPrefix={`track-${track.id}`}
          variant="cell"
        />
      </TableCell>
      <TableCell sx={{ verticalAlign: 'middle' }}>
        <EditableField
          label={t('albumDetail.fields.artist')}
          value={track.artist}
          fieldName="ARTIST"
          onSave={onSave}
          onCommit={onCommit}
          disabled={disabled}
          testIdPrefix={`track-${track.id}`}
          variant="cell"
        />
      </TableCell>
      <TableCell sx={{ verticalAlign: 'middle' }}>{durationDisplay}</TableCell>
      <TableCell sx={{ verticalAlign: 'middle', width: 40, px: 0.5 }}>
        <IconButton
          size="small"
          aria-label={t('albumDetail.showFilePath', { title: track.title ?? track.filePath })}
          aria-describedby={popoverId}
          onClick={handleInfoClick}
          data-testid={`track-${track.id}-file-path-btn`}
          sx={{ minHeight: 36, minWidth: 36 }}
        >
          <InfoOutlinedIcon fontSize="small" />
        </IconButton>
        <Popover
          id={popoverId}
          open={popoverOpen}
          anchorEl={popoverAnchor}
          onClose={handlePopoverClose}
          anchorOrigin={FILE_POPOVER_ANCHOR_ORIGIN}
          transformOrigin={FILE_POPOVER_TRANSFORM_ORIGIN}
          data-testid={`track-${track.id}-file-popover`}
        >
          <Box sx={{ p: 1.5, maxWidth: 480 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              {t('albumDetail.trackColumns.file')}
            </Typography>
            <PathDisplay
              path={track.filePath}
              label={t('albumDetail.trackColumns.file')}
              testId={`track-${track.id}-file-path`}
            />
          </Box>
        </Popover>
      </TableCell>
    </TableRow>
  )
}

/** Parse the leading integer from a string like "1", "2", "A1". Returns Infinity for null/empty. */
function parseLeadingInt(value: string | null | undefined): number {
  if (value === undefined || value === null || value === '') return Infinity
  const match = /^(\d+)/.exec(value)
  return match !== null && match[1] !== undefined ? parseInt(match[1], 10) : Infinity
}
