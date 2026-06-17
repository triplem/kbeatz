import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Snackbar from '@mui/material/Snackbar'
import Typography from '@mui/material/Typography'
import { Album, AlbumDetail, AlbumsService } from '../../api/generated'
import { CancelError } from '../../api/generated/core/CancelablePromise'
import { PageSection, ConfirmDialog, LoadingState } from '../../components'

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

  const handleDismissSuccess = () => {
    setSyncState({ status: 'idle' })
  }

  const isLoading = syncState.status === 'loading'

  return (
    <PageSection
      title={t('syncPanel.heading')}
      ariaLabel={t('syncPanel.ariaLabel')}
      headingLevel="h3"
      testId="sync-panel"
    >
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
            disabled={isLoading}
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
        disabled={isLoading}
        aria-disabled={isLoading}
        aria-label={isLoading
          ? t('syncPanel.syncButtonLoading')
          : t('syncPanel.syncButton')}
        data-testid="sync-button"
        sx={{ alignSelf: 'flex-start', minHeight: 44 }}
      >
        {isLoading ? t('syncPanel.syncButtonLoading') : t('syncPanel.syncButton')}
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
