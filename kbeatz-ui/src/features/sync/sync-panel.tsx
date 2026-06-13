import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Album, AlbumDetail, AlbumsService } from '../../api/generated'
import { CancelError } from '../../api/generated/core/CancelablePromise'
import styles from './sync-panel.module.css'

/** Client-side timeout for Discogs sync requests (30 seconds). */
const SYNC_TIMEOUT_MS = 30_000

/** Tag fields that Discogs sync can update. These are present on both AlbumDetail and Album. */
type SyncTagField = 'albumArtist' | 'album' | 'date' | 'genre' | 'label' | 'catalogNumber' | 'composer' | 'conductor' | 'ensemble'
const SYNC_TAG_FIELDS: ReadonlyArray<SyncTagField> = [
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
function countChangedFields(before: AlbumDetail, after: Album): number {
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
  /** The album detail being viewed. AlbumDetail is used here because SyncPanel
   *  is rendered inside the album detail view and receives the full detail object. */
  readonly album: AlbumDetail
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
  const queryClient = useQueryClient()
  const [downloadImages, setDownloadImages] = useState(false)
  const [syncState, setSyncState] = useState<SyncState>({ status: 'idle' })
  const cancelButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (syncState.status === 'confirmOverwrite') {
      cancelButtonRef.current?.focus()
    }
  }, [syncState.status])

  const syncMutation = useMutation({
    mutationFn: () => {
      const request = AlbumsService.syncAlbumFromDiscogs({
        albumId: album.id,
        requestBody: { downloadImages },
      })
      const timeoutId = setTimeout(() => { request.cancel() }, SYNC_TIMEOUT_MS)
      return request.then((result) => {
        clearTimeout(timeoutId)
        return result
      }).catch((err: unknown) => {
        clearTimeout(timeoutId)
        throw err
      })
    },
    onSuccess: (updated) => {
      const fieldsWritten = countChangedFields(album, updated)
      onSyncComplete(updated)
      queryClient.invalidateQueries({ queryKey: ['albums'] })
      setSyncState({ status: 'success', fieldsWritten })
    },
    onError: (err: unknown) => {
      if (err instanceof CancelError) {
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
    },
  })

  if (!album.discogsId) return null

  const executeSync = () => {
    setSyncState({ status: 'loading' })
    syncMutation.mutate()
  }

  const handleSyncClick = () => {
    if (hasLocalEdits) {
      // Show overwrite warning before proceeding
      setSyncState({ status: 'confirmOverwrite' })
    } else {
      executeSync()
    }
  }

  const handleConfirmOverwrite = () => {
    executeSync()
  }

  const handleCancelOverwrite = () => {
    setSyncState({ status: 'idle' })
  }

  const isLoading = syncState.status === 'loading'

  return (
    <section aria-label={t('syncPanel.ariaLabel')} className={styles.syncPanel}>
      <h3>{t('syncPanel.heading')}</h3>
      <p className={styles.discogsId} data-testid="discogs-id">
        {t('syncPanel.discogsId', { id: album.discogsId })}
      </p>

      <label className={styles.checkboxLabel}>
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
        className={styles.syncButton}
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
          className={styles.overwriteDialog}
        >
          <h4 id="sync-overwrite-title">{t('syncPanel.overwriteTitle')}</h4>
          <p id="sync-overwrite-body">{t('syncPanel.overwriteBody')}</p>
          <div className={styles.overwriteActions}>
            <button
              ref={cancelButtonRef}
              type="button"
              onClick={handleCancelOverwrite}
              data-testid="sync-overwrite-cancel"
              className={styles.overwriteCancelButton}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleConfirmOverwrite}
              data-testid="sync-overwrite-confirm"
              className={styles.overwriteConfirmButton}
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
        <p role="status" aria-live="polite" data-testid="sync-success" className={styles.successMessage}>
          {t('syncPanel.successMessage', { count: syncState.fieldsWritten })}
        </p>
      )}

      {syncState.status === 'error' && (
        <p role="alert" data-testid="sync-error" className={styles.errorMessage}>
          {syncState.message}
        </p>
      )}

      {syncState.status === 'quotaExhausted' && (
        <p role="alert" data-testid="sync-quota-exhausted" className={styles.quotaMessage}>
          {t('syncPanel.quotaExhausted', { resetAt: syncState.resetAt })}
        </p>
      )}
    </section>
  )
}
