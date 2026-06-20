import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Snackbar from '@mui/material/Snackbar'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Album, AlbumDetail, AlbumsService } from '../../api/generated'
import { PageSection, ConfirmDialog, LoadingState, ErrorState } from '../../components'
import { ChangePlanReview } from '../change-plan/ChangePlanReview'
import { useCreateChangePlan } from '../change-plan/useCreateChangePlan'
import { useApplyChangePlan } from '../change-plan/useApplyChangePlan'

/**
 * The sync panel runs a single-album DISCOGS_SYNC change plan. The flow is:
 *  idle -> (optional overwrite confirm) -> review (dry run) -> applying -> success.
 *
 * `review` holds whether the dry-run plan request is still in flight so the
 * dialog can show a loading state, and any plan-fetch error message.
 */
type SyncState =
  | { status: 'idle' }
  | { status: 'confirmOverwrite' }
  | { status: 'review' }
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

interface ApiErrorBody {
  readonly body?: { readonly code?: string; readonly message?: string; readonly details?: string[] }
}

/**
 * SyncPanel - renders the "Sync from Discogs" control block for an album detail view.
 *
 * Only rendered when the album has a `discogsId`. Clicking "Sync from Discogs"
 * runs a DISCOGS_SYNC dry-run change plan (POST /change-plans) and shows the
 * consolidated ChangePlanReview for the single release. Confirming applies the
 * plan (POST /change-plans/{id}/apply); nothing is written until then. After a
 * successful apply the refreshed album is fetched and passed to onSyncComplete,
 * and the number of tag fields written is announced.
 *
 * When `hasLocalEdits` is true, clicking "Sync from Discogs" first shows a
 * confirmation dialog warning that local tag edits will be overwritten.
 */
export function SyncPanel({ album, onSyncComplete, hasLocalEdits = false }: SyncPanelProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [downloadImages, setDownloadImages] = useState(false)
  const [syncState, setSyncState] = useState<SyncState>({ status: 'idle' })

  const {
    createPlan,
    plan,
    isPending: isPlanning,
    error: planError,
    reset: resetPlan,
  } = useCreateChangePlan()
  const { apply, isPending: isApplying, reset: resetApply } = useApplyChangePlan()

  const mapApplyError = useCallback((err: unknown): SyncState => {
    const apiError = err as ApiErrorBody
    const code = apiError.body?.code ?? ''
    const message = apiError.body?.message ?? t('common.unknown')
    if (code === 'IMAGE_QUOTA_EXHAUSTED') {
      const details = apiError.body?.details ?? []
      const resetAtDetail = details.find((d) => d.startsWith('resetAt='))
      const resetAt = resetAtDetail ? resetAtDetail.replace('resetAt=', '') : t('common.unknown')
      return { status: 'quotaExhausted', resetAt }
    }
    return { status: 'error', message }
  }, [t])

  const openReview = useCallback(() => {
    setSyncState({ status: 'review' })
    void createPlan({ operation: 'DISCOGS_SYNC', albumIds: [album.id] }).catch(() => {
      // Surfaced via planError inside the review dialog.
    })
  }, [createPlan, album.id])

  if (!album.discogsId) return null

  const handleSyncClick = () => {
    resetPlan()
    resetApply()
    if (hasLocalEdits) {
      setSyncState({ status: 'confirmOverwrite' })
    } else {
      openReview()
    }
  }

  const handleConfirmOverwrite = () => {
    openReview()
  }

  const handleCancelOverwrite = () => {
    setSyncState({ status: 'idle' })
  }

  const handleReviewCancel = () => {
    // Cancel at review writes nothing.
    resetPlan()
    resetApply()
    setSyncState({ status: 'idle' })
  }

  const handleReviewConfirm = () => {
    if (!plan) return
    apply(plan.id)
      .then((result) => {
        const release = result.releases.find((r) => r.albumId === album.id)
        if (release && release.outcome === 'FAILED') {
          setSyncState({ status: 'error', message: release.message ?? t('common.error') })
          return
        }
        const fieldsWritten = plan.totalTagChanges
        return AlbumsService.getAlbum({ albumId: album.id }).then((updated) => {
          onSyncComplete(updated)
          void queryClient.invalidateQueries({ queryKey: ['albums'] })
          void queryClient.invalidateQueries({ queryKey: ['album', album.id] })
          setSyncState({ status: 'success', fieldsWritten })
        })
      })
      .catch((err: unknown) => {
        setSyncState(mapApplyError(err))
      })
  }

  const handleDismissSuccess = () => {
    setSyncState({ status: 'idle' })
  }

  const isReview = syncState.status === 'review'
  const isBusy = isReview || isApplying

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
            disabled={isBusy}
            slotProps={{
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
        aria-label={isApplying
          ? t('syncPanel.syncButtonLoading')
          : t('syncPanel.syncButton')}
        data-testid="sync-button"
        sx={{ alignSelf: 'flex-start', minHeight: 44 }}
      >
        {isApplying ? t('syncPanel.syncButtonLoading') : t('syncPanel.syncButton')}
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

      {isReview && (
        <Box
          role="region"
          aria-label={t('syncPanel.reviewLabel')}
          data-testid="sync-review"
          sx={{
            mt: 1,
            p: 2,
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {isPlanning && (
            <LoadingState message={t('changePlan.planning')} testId="sync-review-loading" />
          )}

          {!isPlanning && planError !== null && (
            <ErrorState
              message={t('changePlan.planError')}
              onRetry={openReview}
              retryLabel={t('common.retry')}
              testId="sync-review-error"
            />
          )}

          {!isPlanning && planError === null && plan !== undefined && (
            <ChangePlanReview plan={plan} />
          )}

          {isApplying && (
            <LoadingState message={t('syncPanel.loadingMessage')} testId="sync-loading" />
          )}

          <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
            <Button
              type="button"
              variant="outlined"
              color="inherit"
              onClick={handleReviewCancel}
              disabled={isApplying}
              data-testid="sync-review-cancel"
              sx={{ minHeight: 44 }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="contained"
              onClick={handleReviewConfirm}
              disabled={isPlanning || isApplying || planError !== null || plan === undefined}
              data-testid="sync-review-confirm"
              sx={{ minHeight: 44 }}
            >
              {t('syncPanel.confirmSync')}
            </Button>
          </Stack>
        </Box>
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
