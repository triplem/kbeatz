import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Album, AlbumsService } from '../../api/generated'

/** Client-side timeout for Discogs sync requests (30 seconds). */
const SYNC_TIMEOUT_MS = 30_000

/** Tag fields that Discogs sync can update. */
const SYNC_TAG_FIELDS: ReadonlyArray<keyof Album> = [
  'albumArtist',
  'album',
  'date',
  'genre',
  'label',
  'catalogNumber',
  'composer',
  'conductor',
  'ensemble',
]

/** Count how many tag fields differ between the album before and after sync. */
function countChangedFields(before: Album, after: Album): number {
  return SYNC_TAG_FIELDS.filter((field) => before[field] !== after[field]).length
}

type SyncState =
  | { status: 'idle' }
  | { status: 'confirmOverwrite' }
  | { status: 'loading' }
  | { status: 'success'; fieldsWritten: number }
  | { status: 'error'; message: string }
  | { status: 'quotaExhausted'; resetAt: string }

interface SyncPanelProps {
  readonly album: Album
  readonly onSyncComplete: (updated: Album) => void
  /** When true the user has edited tags locally since the last sync; a confirmation
   *  dialog is shown before the sync proceeds to prevent silent overwrites. */
  readonly hasLocalEdits?: boolean
}

/**
 * SyncPanel - renders the "Sync from Discogs" control block for an album detail view.
 *
 * Only rendered when the album has a `discogsId`.
 * Calls POST /api/v1/albums/{albumId}/sync and handles all response states.
 * Displays the number of tag fields updated after a successful sync.
 *
 * When `hasLocalEdits` is true, clicking "Sync from Discogs" first shows a
 * confirmation dialog warning the user that local tag edits will be overwritten.
 */
export function SyncPanel({ album, onSyncComplete, hasLocalEdits = false }: SyncPanelProps) {
  const { t } = useTranslation()
  const [downloadImages, setDownloadImages] = useState(false)
  const [syncState, setSyncState] = useState<SyncState>({ status: 'idle' })

  if (!album.discogsId) return null

  const executeSync = async () => {
    setSyncState({ status: 'loading' })
    const controller = new AbortController()
    const timeoutId = setTimeout(() => { controller.abort() }, SYNC_TIMEOUT_MS)
    try {
      const updated = await AlbumsService.syncAlbumFromDiscogs({
        albumId: album.id,
        requestBody: { downloadImages },
      })
      clearTimeout(timeoutId)
      const fieldsWritten = countChangedFields(album, updated)
      onSyncComplete(updated)
      setSyncState({ status: 'success', fieldsWritten })
    } catch (err: unknown) {
      clearTimeout(timeoutId)
      // AbortError means the client-side timeout fired
      if (err instanceof DOMException && err.name === 'AbortError') {
        setSyncState({ status: 'error', message: t('syncPanel.syncTimeout') })
        return
      }
      const apiError = err as { body?: { code?: string; message?: string; details?: string[] } }
      const code = apiError.body?.code ?? ''
      const message = apiError.body?.message ?? t('common.unknown')

      if (code === 'IMAGE_QUOTA_EXHAUSTED') {
        const details = apiError.body?.details ?? []
        const resetAtDetail = details.find((d) => d.startsWith('resetAt='))
        const resetAt = resetAtDetail ? resetAtDetail.replace('resetAt=', '') : t('common.unknown')
        setSyncState({ status: 'quotaExhausted', resetAt })
      } else {
        setSyncState({ status: 'error', message })
      }
    }
  }

  const handleSyncClick = () => {
    if (hasLocalEdits) {
      // Show overwrite warning before proceeding
      setSyncState({ status: 'confirmOverwrite' })
    } else {
      void executeSync()
    }
  }

  const handleConfirmOverwrite = () => {
    void executeSync()
  }

  const handleCancelOverwrite = () => {
    setSyncState({ status: 'idle' })
  }

  const isLoading = syncState.status === 'loading'

  return (
    <section aria-label={t('syncPanel.ariaLabel')} className="sync-panel">
      <h3>{t('syncPanel.heading')}</h3>
      <p className="sync-discogs-id">
        {t('syncPanel.discogsId', { id: album.discogsId })}
        <span data-testid="discogs-id" style={{ display: 'none' }}>{album.discogsId}</span>
      </p>

      <label className="sync-checkbox-label">
        <input
          type="checkbox"
          checked={downloadImages}
          onChange={(e) => { setDownloadImages(e.target.checked) }}
          disabled={isLoading}
          data-testid="download-images-checkbox"
          aria-label={t('syncPanel.downloadImagesAriaLabel')}
        />
        {' '}{t('syncPanel.downloadImages')}
      </label>

      <button
        type="button"
        onClick={handleSyncClick}
        disabled={isLoading}
        aria-disabled={isLoading}
        aria-label={isLoading
          ? t('syncPanel.syncButtonLoading')
          : t('syncPanel.syncButton')}
        data-testid="sync-button"
        className="sync-button"
      >
        {isLoading ? t('syncPanel.syncButtonLoading') : t('syncPanel.syncButton')}
      </button>

      {/* Overwrite warning dialog */}
      {syncState.status === 'confirmOverwrite' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="sync-overwrite-title"
          aria-describedby="sync-overwrite-body"
          data-testid="sync-overwrite-dialog"
          className="sync-overwrite-dialog"
        >
          <h4 id="sync-overwrite-title">{t('syncPanel.overwriteTitle')}</h4>
          <p id="sync-overwrite-body">{t('syncPanel.overwriteBody')}</p>
          <div className="sync-overwrite-dialog__actions">
            <button
              type="button"
              onClick={handleCancelOverwrite}
              data-testid="sync-overwrite-cancel"
              className="sync-overwrite-dialog__cancel"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleConfirmOverwrite}
              data-testid="sync-overwrite-confirm"
              className="sync-overwrite-dialog__confirm"
            >
              {t('syncPanel.overwriteConfirm')}
            </button>
          </div>
        </div>
      )}

      {syncState.status === 'loading' && (
        <p role="status" aria-live="polite" data-testid="sync-loading">
          {t('syncPanel.loadingMessage')}
        </p>
      )}

      {syncState.status === 'success' && (
        <p role="status" aria-live="polite" data-testid="sync-success" className="sync-success">
          {t('syncPanel.successMessage', { count: syncState.fieldsWritten })}
        </p>
      )}

      {syncState.status === 'error' && (
        <p role="alert" data-testid="sync-error" className="sync-error">
          {syncState.message}
        </p>
      )}

      {syncState.status === 'quotaExhausted' && (
        <p role="alert" data-testid="sync-quota-exhausted" className="sync-quota-exhausted">
          {t('syncPanel.quotaExhausted', { resetAt: syncState.resetAt })}
        </p>
      )}
    </section>
  )
}
