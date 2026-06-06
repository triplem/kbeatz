import { useState } from 'react'
import { Album, AlbumsService } from '../../api/generated'

type SyncState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; fieldsWritten: number }
  | { status: 'error'; message: string }
  | { status: 'quotaExhausted'; resetAt: string }

interface SyncPanelProps {
  readonly album: Album
  readonly onSyncComplete: (updated: Album) => void
}

/**
 * SyncPanel — renders the "Sync from Discogs" control block for an album detail view.
 *
 * Only rendered when the album has a `discogsId`.
 * Calls POST /api/v1/albums/{albumId}/sync and handles all response states.
 */
export function SyncPanel({ album, onSyncComplete }: SyncPanelProps) {
  const [downloadImages, setDownloadImages] = useState(false)
  const [syncState, setSyncState] = useState<SyncState>({ status: 'idle' })

  if (!album.discogsId) return null

  const handleSync = async () => {
    setSyncState({ status: 'loading' })
    try {
      const updated = await AlbumsService.syncAlbumFromDiscogs({
        albumId: album.id,
        requestBody: { downloadImages },
      })
      onSyncComplete(updated)
      setSyncState({ status: 'success', fieldsWritten: 0 })
    } catch (err: unknown) {
      const apiError = err as { body?: { code?: string; message?: string; details?: string[] } }
      const code = apiError.body?.code ?? ''
      const message = apiError.body?.message ?? 'Unknown error'

      if (code === 'IMAGE_QUOTA_EXHAUSTED') {
        const details = apiError.body?.details ?? []
        const resetAtDetail = details.find((d) => d.startsWith('resetAt='))
        const resetAt = resetAtDetail ? resetAtDetail.replace('resetAt=', '') : 'unknown'
        setSyncState({ status: 'quotaExhausted', resetAt })
      } else {
        setSyncState({ status: 'error', message })
      }
    }
  }

  return (
    <section aria-label="Sync from Discogs" className="sync-panel">
      <h3>Sync from Discogs</h3>
      <p className="sync-discogs-id">
        Discogs ID: <span data-testid="discogs-id">{album.discogsId}</span>
      </p>

      <label className="sync-checkbox-label">
        <input
          type="checkbox"
          checked={downloadImages}
          onChange={(e) => { setDownloadImages(e.target.checked) }}
          disabled={syncState.status === 'loading'}
          data-testid="download-images-checkbox"
        />
        {' '}Also update cover art
      </label>

      <button
        type="button"
        onClick={() => { void handleSync() }}
        disabled={syncState.status === 'loading'}
        data-testid="sync-button"
        className="sync-button"
      >
        {syncState.status === 'loading' ? 'Syncing…' : 'Sync from Discogs'}
      </button>

      {syncState.status === 'loading' && (
        <p role="status" aria-live="polite" data-testid="sync-loading">
          Syncing with Discogs…
        </p>
      )}

      {syncState.status === 'success' && (
        <p role="status" aria-live="polite" data-testid="sync-success" className="sync-success">
          Sync complete.
        </p>
      )}

      {syncState.status === 'error' && (
        <p role="alert" data-testid="sync-error" className="sync-error">
          {syncState.message}
        </p>
      )}

      {syncState.status === 'quotaExhausted' && (
        <p role="alert" data-testid="sync-quota-exhausted" className="sync-quota-exhausted">
          Image quota exhausted. Resets at {syncState.resetAt}.
        </p>
      )}
    </section>
  )
}
