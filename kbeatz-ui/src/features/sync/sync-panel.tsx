import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Snackbar from '@mui/material/Snackbar'
import Typography from '@mui/material/Typography'
import { Album, AlbumDetail, AlbumsService } from '../../api/generated'
import type { SyncFieldChange } from '../../api/generated'
import { CancelError } from '../../api/generated/core/CancelablePromise'
import { PageSection, ConfirmDialog, LoadingState } from '../../components'
import { SyncPreviewDialog } from '../albums/sync-preview-dialog'

/** Client-side timeout for Discogs sync requests (30 seconds). */
const SYNC_TIMEOUT_MS = 30_000

/**
 * Tag fields that Discogs sync can update. Each entry is verified at compile time
 * to be a key present on both AlbumDetail and Album via the `satisfies` constraint.
 */
const SYNC_TAG_FIELDS = [
  'albumArtist',
  'album',
  'date',
  'genre',
  'label',
  'catalogNumber',
  'composer',
  'conductor',
  'ensemble',
] as const satisfies ReadonlyArray<keyof AlbumDetail & keyof Album>

/** Count how many tag fields differ between the album before and after sync. */
function countChangedFields(before: AlbumDetail, after: Album): number {
  return SYNC_TAG_FIELDS.filter((field) => before[field] !== after[field]).length
}

type SyncState =
  | { status: 'idle' }
  | { status: 'confirmOverwrite' }
  | { status: 'preview'; loading: boolean; error: string | null; changes: SyncFieldChange[] }
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
 * Rebuilt on MUI primitives (PageSection, Checkbox, Button, Snackbar, Alert) and
 * the shared ConfirmDialog so it is theme-aware in light and dark modes.
 *
 * Only rendered when the album has a `discogsId`.
 * Calls GET /api/v1/albums/{albumId}/sync/preview first, shows the SyncPreviewDialog
 * for user confirmation, then calls POST /api/v1/albums/{albumId}/sync on confirm.
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

  /**
   * Tracks the in-flight CancelablePromise for the preview fetch so it can be
   * cancelled if the component unmounts before the response arrives, preventing
   * a React "state update on unmounted component" warning.
   */
  const previewRequestRef = useRef<{ cancel: () => void } | null>(null)

  // Cancel any in-flight preview request when the component unmounts
  useEffect(() => {
    return () => {
      previewRequestRef.current?.cancel()
    }
  }, [])

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

  // fetchPreview must be declared before the early return to satisfy React hooks rules
  const fetchPreview = useCallback(() => {
    setSyncState({ status: 'preview', loading: true, error: null, changes: [] })
    const request = AlbumsService.previewSyncFromDiscogs({ albumId: album.id })
    previewRequestRef.current = request
    request
      .then((preview) => {
        previewRequestRef.current = null
        setSyncState({ status: 'preview', loading: false, error: null, changes: preview.proposedChanges })
      })
      .catch((err: unknown) => {
        previewRequestRef.current = null
        const apiError = err as { body?: { message?: string } }
        const message = apiError.body?.message ?? t('common.error')
        setSyncState({ status: 'preview', loading: false, error: message, changes: [] })
      })
  }, [album.id, t])

  if (!album.discogsId) return null

  const executeSync = () => {
    setSyncState({ status: 'loading' })
    syncMutation.mutate()
  }

  const handleSyncClick = () => {
    if (hasLocalEdits) {
      setSyncState({ status: 'confirmOverwrite' })
    } else {
      fetchPreview()
    }
  }

  const handleConfirmOverwrite = () => {
    fetchPreview()
  }

  const handleCancelOverwrite = () => {
    setSyncState({ status: 'idle' })
  }

  const handlePreviewConfirm = () => {
    executeSync()
  }

  const handlePreviewCancel = () => {
    setSyncState({ status: 'idle' })
  }

  const handleDismissSuccess = () => {
    setSyncState({ status: 'idle' })
  }

  // The sync button is busy whenever the sync itself is running OR while the preview
  // is being fetched. Guarding the preview-loading state prevents duplicate Discogs
  // API calls if the user clicks the button more than once while the fetch is in flight.
  const isPreviewLoading = syncState.status === 'preview' && syncState.loading
  const isSyncLoading = syncState.status === 'loading'
  const isBusy = isSyncLoading || isPreviewLoading

  const previewOpen = syncState.status === 'preview'

  return (
    <PageSection
      title={t('syncPanel.heading')}
      ariaLabel={t('syncPanel.ariaLabel')}
      headingLevel="h3"
      testId="sync-panel"
    >
      <SyncPreviewDialog
        open={previewOpen}
        loading={previewOpen && syncState.loading}
        error={previewOpen ? syncState.error : null}
        changes={previewOpen ? syncState.changes : []}
        onConfirm={handlePreviewConfirm}
        onCancel={handlePreviewCancel}
      />

      <Typography
        variant="body2"
        color="text.secondary"
        component="p"
        data-testid="discogs-id"
        sx={{ m: 0 }}
      >
        {t('syncPanel.discogsId', { id: album.discogsId })}
      </Typography>

      <FormControlLabel
        control={
          <Checkbox
            checked={downloadImages}
            onChange={(e) => { setDownloadImages(e.target.checked) }}
            disabled={isBusy}
            slotProps={{
              // data-testid on the underlying input so toBeChecked()/click target the
              // checkbox element rather than the MUI root span. The slot input props
              // type does not enumerate data-* attributes, so it is widened here.
              input: {
                'aria-label': t('syncPanel.downloadImagesAriaLabel'),
                'data-testid': 'download-images-checkbox',
              } as React.InputHTMLAttributes<HTMLInputElement>,
            }}
          />
        }
        label={t('syncPanel.downloadImages')}
        sx={{ alignSelf: 'flex-start', m: 0 }}
      />

      <Button
        type="button"
        variant="contained"
        onClick={handleSyncClick}
        disabled={isBusy}
        aria-disabled={isBusy}
        aria-label={isSyncLoading
          ? t('syncPanel.syncButtonLoading')
          : t('syncPanel.syncButton')}
        data-testid="sync-button"
        sx={{ alignSelf: 'flex-start', minHeight: 44 }}
      >
        {isSyncLoading ? t('syncPanel.syncButtonLoading') : t('syncPanel.syncButton')}
      </Button>

      <ConfirmDialog
        open={syncState.status === 'confirmOverwrite'}
        title={t('syncPanel.overwriteTitle')}
        body={t('syncPanel.overwriteBody')}
        confirmLabel={t('syncPanel.overwriteConfirm')}
        cancelLabel={t('common.cancel')}
        onConfirm={handleConfirmOverwrite}
        onCancel={handleCancelOverwrite}
        testId="sync-overwrite-dialog"
      />

      {syncState.status === 'loading' && (
        <LoadingState message={t('syncPanel.loadingMessage')} testId="sync-loading" />
      )}

      <Snackbar
        open={syncState.status === 'success'}
        onClose={handleDismissSuccess}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleDismissSuccess}
          severity="success"
          role="status"
          aria-live="polite"
          data-testid="sync-success"
          sx={{ width: '100%' }}
        >
          {syncState.status === 'success'
            ? t('syncPanel.successMessage', { count: syncState.fieldsWritten })
            : ''}
        </Alert>
      </Snackbar>

      {syncState.status === 'error' && (
        <Alert severity="error" role="alert" data-testid="sync-error" sx={{ mt: 1 }}>
          {syncState.message}
        </Alert>
      )}

      {syncState.status === 'quotaExhausted' && (
        <Alert severity="warning" role="alert" data-testid="sync-quota-exhausted" sx={{ mt: 1 }}>
          {t('syncPanel.quotaExhausted', { resetAt: syncState.resetAt })}
        </Alert>
      )}
    </PageSection>
  )
}
