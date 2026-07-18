import { Fragment, useCallback, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@astryxdesign/core/Button'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Popover } from '@astryxdesign/core/Popover'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'
import { Icon } from '@astryxdesign/core/Icon'
import { ArrowLeft, X, Info } from 'lucide-react'
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
import { groupByDisc } from './trackListUtils'

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

const cellStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '4px 8px',
  borderBottom: '1px solid var(--color-border)',
  verticalAlign: 'middle',
}

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
    <span
      data-testid={testId}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0, maxWidth: '100%' }}
    >
      <span
        title={path}
        style={{
          fontFamily: 'monospace',
          fontSize: '0.8125rem',
          color: 'var(--color-text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 0,
        }}
      >
        {path}
      </span>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={handleCopy}
        aria-label={t('albumDetail.copyPath', { label })}
        data-testid={testId !== undefined ? `${testId}-copy` : undefined}
        label={copied ? t('albumDetail.copied') : t('albumDetail.copy')}
      />
    </span>
  )
}

export interface AlbumDetailEditProps {
  /** Album data to display in the edit form. */
  readonly album: AlbumDetailModel
  /** Called when the user cancels without dirty changes or confirms the cancel guard dialog. */
  readonly onExitEditMode: () => void
  /** Called when a Discogs sync completes with the updated album data. */
  readonly onSyncComplete: (updated: Album) => void
  /**
   * Called immediately after a successful batch save so the parent wrapper can mark
   * that local edits exist (relevant to the SyncPanel overwrite-warning dialog).
   */
  readonly onSaveComplete?: () => void
  /** True after any album-level tag has been successfully saved since the last sync. */
  readonly hasLocalEdits: boolean
  /** Ref attached to the Cancel button for focus management. */
  readonly cancelButtonRef: React.RefObject<HTMLButtonElement | null>
}

/**
 * AlbumDetailEdit - full edit layout with all Vorbis Comment tag fields.
 *
 * Owns dirtyFields/dirtyTrackFields (pending unsaved changes), isSaving,
 * confirmOpen (ConfirmWriteDialog), batchSaveError, and cancelGuardOpen.
 * Does NOT own isEditMode / syncedAlbum (those belong to the AlbumDetail wrapper).
 */
export function AlbumDetailEdit({
  album,
  onExitEditMode,
  onSyncComplete,
  onSaveComplete,
  hasLocalEdits,
  cancelButtonRef,
}: AlbumDetailEditProps) {
  const { albumId } = useParams<{ albumId: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [isSaving, setIsSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [dirtyFields, setDirtyFields] = useState<Record<string, string>>({})
  const [dirtyTrackFields, setDirtyTrackFields] = useState<Record<string, Record<string, string>>>({})
  const [batchSaveError, setBatchSaveError] = useState<string | null>(null)
  const [cancelGuardOpen, setCancelGuardOpen] = useState(false)

  const hasAnyDirty = Object.keys(dirtyFields).length > 0 || Object.keys(dirtyTrackFields).length > 0

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

  const handleAlbumTagCommit = useCallback((field: string, value: string) => {
    setDirtyFields((prev) => ({ ...prev, [field]: value }))
  }, [])

  const handleAlbumTagSave = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_field: string, _value: string): Promise<void> => {
      const err = new Error('Album field onSave called unexpectedly - use onCommit')
      err.name = 'InternalSentinelError'
      return Promise.reject(err)
    },
    [],
  )

  const handleSaveButtonClick = useCallback(() => {
    if (!hasAnyDirty) return
    setBatchSaveError(null)
    setConfirmOpen(true)
  }, [hasAnyDirty])

  const handleConfirm = useCallback(async () => {
    setConfirmOpen(false)

    if (!albumId) return

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
      onSaveComplete?.()
      void queryClient.invalidateQueries({ queryKey: ['albums'] })
    } catch (err) {
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
  }, [albumId, dirtyFields, dirtyTrackFields, onSaveComplete, queryClient, t])

  const handleConfirmDialogCancel = useCallback(() => {
    setConfirmOpen(false)
  }, [])

  const handleCancelClick = useCallback(() => {
    if (!hasAnyDirty) {
      onExitEditMode()
      return
    }
    setCancelGuardOpen(true)
  }, [hasAnyDirty, onExitEditMode])

  const handleCancelGuardConfirm = useCallback(() => {
    setCancelGuardOpen(false)
    setDirtyFields({})
    setDirtyTrackFields({})
    setBatchSaveError(null)
    onExitEditMode()
  }, [onExitEditMode])

  const handleCancelGuardCancel = useCallback(() => {
    setCancelGuardOpen(false)
  }, [])

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

  const handleTrackTagSaveSentinel = useCallback(
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
    setDirtyFields({})
    setDirtyTrackFields({})
    setBatchSaveError(null)
    onSyncComplete(updated)
  }, [onSyncComplete])

  const albumDirtyCount = Object.keys(dirtyFields).length
  const trackDirtyCount = Object.values(dirtyTrackFields).reduce(
    (sum, fields) => sum + Object.keys(fields).length,
    0,
  )
  const dirtyCount = albumDirtyCount + trackDirtyCount

  const saveAriaLabel = dirtyCount > 0
    ? t('albumDetail.saveButtonLabel', { count: dirtyCount })
    : t('albumDetail.saveButtonLabelClean')

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
      <article
        aria-label={t('albumDetail.albumTagsSection')}
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        {/* Visually-hidden page heading anchoring the outline (WCAG 1.3.1 / 2.4.6). */}
        <div style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
          <h1>{album.album}</h1>
        </div>

        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            type="button"
            variant="secondary"
            icon={<Icon icon={ArrowLeft} />}
            onClick={() => { navigate(-1) }}
            data-testid="back-button"
            label={t('common.back')}
          />

          <Button
            ref={cancelButtonRef}
            type="button"
            variant="secondary"
            icon={<Icon icon={X} />}
            onClick={handleCancelClick}
            data-testid="cancel-edit-button"
            label={t('albumDetail.cancelButton')}
          />

          <Button
            type="button"
            variant="primary"
            onClick={handleSaveButtonClick}
            isDisabled={!hasAnyDirty || isSaving}
            data-testid="save-button-top"
            aria-label={saveAriaLabel}
            label={isSaving ? t('albumDetail.saving') : t('albumDetail.saveButton')}
          />
        </div>

        <AlbumHeroHeader album={album} />

        <div data-testid="edit-layout" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
          <div data-testid="metadata-column" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {album.hasCoverArt && (
              <img
                src={`/api/v1/albums/${album.id}/cover`}
                alt={t('albumDetail.coverAlt', { album: album.album })}
                loading="lazy"
                data-testid="album-cover"
                style={{
                  width: '100%',
                  maxWidth: 320,
                  aspectRatio: '1 / 1',
                  objectFit: 'cover',
                  borderRadius: 'var(--radius-container, 12px)',
                  boxShadow: 'var(--shadow-med, 0 4px 12px rgba(0,0,0,0.15))',
                }}
              />
            )}

            <section aria-labelledby="album-tags-heading">
              <div style={{ marginBottom: 16 }}>
                <Heading level={2} id="album-tags-heading">
                  {t('albumDetail.sectionTitle')}
                </Heading>
              </div>
              {isSaving && (
                <p role="status" aria-live="polite" data-testid="album-saving-indicator" style={{ margin: '0 0 8px' }}>
                  <Text type="supporting">{t('albumDetail.saving')}</Text>
                </p>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, minWidth: 0 }}>
                <Text type="supporting" weight="medium">{t('albumDetail.fields.albumPath')}</Text>
                <PathDisplay
                  path={album.albumPath}
                  label={t('albumDetail.fields.albumPath')}
                  testId="album-path"
                />
              </div>
              <p id="edit-scope-notice" data-testid="edit-scope-notice" style={{ margin: '0 0 8px' }}>
                <Text type="supporting">{t('albumDetail.editScopeNotice', { count: album.tracks.length })}</Text>
              </p>
              <dl
                id="album-tags"
                style={{
                  margin: 0,
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-container, 12px)',
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
              </dl>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleSaveButtonClick}
                  isDisabled={!hasAnyDirty || isSaving}
                  data-testid="save-button"
                  aria-label={saveAriaLabel}
                  label={isSaving ? t('albumDetail.saving') : t('albumDetail.saveButton')}
                />
                {dirtyCount > 0 && (
                  <span data-testid="dirty-count">
                    <Text type="supporting">{t('albumDetail.dirtyCount', { count: dirtyCount })}</Text>
                  </span>
                )}
                {batchSaveError !== null && (
                  <p
                    role="alert"
                    data-testid="batch-save-error"
                    style={{ margin: 0, width: '100%', color: 'var(--color-error, #d6336c)' }}
                  >
                    {t('editableField.saveFailed')}: {batchSaveError}
                  </p>
                )}
              </div>
            </section>

            <OtherTagsSection />

            {album.discogsId !== undefined && (
              <section aria-label={t('albumDetail.discogsSection')}>
                <SyncPanel album={album} onSyncComplete={handleSyncCompleteInternal} hasLocalEdits={hasLocalEdits} />
              </section>
            )}
          </div>

          <div data-testid="tracklist-column" style={{ minWidth: 0 }}>
            <section aria-label={t('albumDetail.tracksSection')}>
              <div style={{ marginBottom: 16 }}>
                <Heading level={2}>{t('albumDetail.tracksSectionTitle')}</Heading>
              </div>
              {album.tracks.length === 0
                ? (
                  <p style={{ padding: '16px 0' }}>
                    <Text type="supporting">{t('albumDetail.noTracks')}</Text>
                  </p>
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
            </section>
          </div>
        </div>
      </article>
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
    <section aria-label={t('albumDetail.otherTagsSection')} data-testid="other-tags-section">
      <div style={{ marginBottom: 4 }}>
        <Heading level={2}>{t('albumDetail.otherTagsTitle')}</Heading>
      </div>
      <p style={{ margin: '0 0 8px' }}>
        <Text type="supporting">{t('albumDetail.otherTagsDescription')}</Text>
      </p>
      <p data-testid="other-tags-empty" style={{ margin: 0 }}>
        <Text type="supporting">{t('albumDetail.otherTagsEmpty')}</Text>
      </p>
    </section>
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

  const { groups, isMultiDisc } = groupByDisc(tracks)

  return (
    <div style={{ overflowX: 'auto' }}>
      <table aria-label={t('albumDetail.tracksSectionTitle')} style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th scope="col" style={cellStyle}><Text type="label">{t('albumDetail.trackColumns.position')}</Text></th>
            <th scope="col" style={cellStyle}><Text type="label">{t('albumDetail.trackColumns.title')}</Text></th>
            <th scope="col" style={cellStyle}><Text type="label">{t('albumDetail.trackColumns.artist')}</Text></th>
            <th scope="col" style={cellStyle}><Text type="label">{t('albumDetail.trackColumns.duration')}</Text></th>
            <th scope="col" style={cellStyle} aria-label={t('albumDetail.trackColumns.actions')} />
          </tr>
        </thead>
        <tbody>
          {groups.map((group, groupIndex) => (
            <Fragment key={`${group.discLabel ?? 'no-disc'}-${groupIndex}`}>
              {isMultiDisc && group.discLabel !== null && (
                <tr>
                  <td
                    colSpan={5}
                    style={{ ...cellStyle, fontWeight: 600, background: 'var(--color-background-muted, rgba(128,128,128,0.1))' }}
                  >
                    <Text type="supporting" weight="semibold">
                      {t('albumDetail.discHeader', { number: group.discLabel })}
                    </Text>
                  </td>
                </tr>
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
        </tbody>
      </table>
    </div>
  )
}

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

  // Astryx Popover keeps its content mounted, so drive it in controlled mode and
  // only render the file-path content when open. This keeps the path out of the
  // DOM until the info button is activated.
  const [pathOpen, setPathOpen] = useState(false)

  return (
    <tr data-testid={`track-row-${track.id}`}>
      <td style={cellStyle}>
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
      </td>
      <td style={cellStyle}>
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
      </td>
      <td style={cellStyle}>
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
      </td>
      <td style={cellStyle}>
        <Text type="supporting">{durationDisplay}</Text>
      </td>
      <td style={{ ...cellStyle, width: 40, padding: '4px 4px' }}>
        <Popover
          placement="end"
          isOpen={pathOpen}
          onOpenChange={setPathOpen}
          content={
            pathOpen ? (
              <div data-testid={`track-${track.id}-file-popover`} style={{ padding: 12, maxWidth: 480 }}>
                <div style={{ marginBottom: 4 }}>
                  <Text type="supporting">{t('albumDetail.trackColumns.file')}</Text>
                </div>
                <PathDisplay
                  path={track.filePath}
                  label={t('albumDetail.trackColumns.file')}
                  testId={`track-${track.id}-file-path`}
                />
              </div>
            ) : null
          }
        >
          <IconButton
            variant="ghost"
            size="sm"
            label={t('albumDetail.showFilePath', { title: track.title ?? track.filePath })}
            data-testid={`track-${track.id}-file-path-btn`}
            icon={<Icon icon={Info} />}
          />
        </Popover>
      </td>
    </tr>
  )
}
