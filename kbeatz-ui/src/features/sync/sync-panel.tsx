import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Icon } from '@astryxdesign/core/Icon'
import { Text } from '@astryxdesign/core/Text'
import { X } from 'lucide-react'
import { Album, AlbumDetail, AlbumsService } from '../../api/generated'
import { PageSection, ConfirmDialog, LoadingState, ErrorState } from '../../components'
import { ChangePlanReview } from '../change-plan/ChangePlanReview'
import { useCreateChangePlan } from '../change-plan/useCreateChangePlan'
import { useApplyChangePlan } from '../change-plan/useApplyChangePlan'

/**
 * The sync panel runs a single-album DISCOGS_SYNC change plan. The flow is:
 *  idle -> (optional overwrite confirm) -> review (dry run) -> applying -> success.
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
 * runs a DISCOGS_SYNC dry-run change plan and shows the consolidated
 * ChangePlanReview for the single release. Confirming applies the plan; nothing
 * is written until then. After a successful apply the refreshed album is fetched
 * and passed to onSyncComplete, and the number of tag fields written is announced.
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
      <p data-testid="discogs-id" style={{ margin: 0 }}>
        <Text type="supporting">{t('syncPanel.discogsId', { id: album.discogsId })}</Text>
      </p>

      <div style={{ alignSelf: 'flex-start' }}>
        <CheckboxInput
          label={t('syncPanel.downloadImages')}
          aria-label={t('syncPanel.downloadImagesAriaLabel')}
          value={downloadImages}
          onChange={(checked) => { setDownloadImages(checked) }}
          isDisabled={isBusy}
          data-testid="download-images-checkbox"
        />
      </div>

      <div style={{ alignSelf: 'flex-start' }}>
        <Button
          type="button"
          variant="primary"
          onClick={handleSyncClick}
          isDisabled={isBusy}
          isLoading={isApplying}
          aria-label={isApplying ? t('syncPanel.syncButtonLoading') : t('syncPanel.syncButton')}
          data-testid="sync-button"
          label={isApplying ? t('syncPanel.syncButtonLoading') : t('syncPanel.syncButton')}
        />
      </div>

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
        <div
          role="region"
          aria-label={t('syncPanel.reviewLabel')}
          data-testid="sync-review"
          style={{
            marginTop: 8,
            padding: 16,
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-element, 8px)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
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

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button
              type="button"
              variant="secondary"
              onClick={handleReviewCancel}
              isDisabled={isApplying}
              data-testid="sync-review-cancel"
              label={t('common.cancel')}
            />
            <Button
              type="button"
              variant="primary"
              onClick={handleReviewConfirm}
              isDisabled={isPlanning || isApplying || planError !== null || plan === undefined}
              data-testid="sync-review-confirm"
              label={t('syncPanel.confirmSync')}
            />
          </div>
        </div>
      )}

      {syncState.status === 'success' && (
        <div
          role="status"
          aria-live="polite"
          data-testid="sync-success"
          style={{
            marginTop: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: 12,
            borderRadius: 'var(--radius-element, 8px)',
            background: 'var(--color-success-muted, rgba(46, 196, 182, 0.12))',
          }}
        >
          <Text type="supporting">
            {t('syncPanel.successMessage', { count: syncState.fieldsWritten })}
          </Text>
          <div style={{ marginInlineStart: 'auto' }}>
            <IconButton
              variant="ghost"
              size="sm"
              label={t('common.dismiss')}
              onClick={handleDismissSuccess}
              icon={<Icon icon={X} />}
            />
          </div>
        </div>
      )}

      {syncState.status === 'error' && (
        <div role="alert" data-testid="sync-error" style={{ marginTop: 8 }}>
          <Banner status="error" title={syncState.message} />
        </div>
      )}

      {syncState.status === 'quotaExhausted' && (
        <div role="alert" data-testid="sync-quota-exhausted" style={{ marginTop: 8 }}>
          <Banner
            status="warning"
            title={t('syncPanel.quotaExhausted', { resetAt: syncState.resetAt })}
          />
        </div>
      )}
    </PageSection>
  )
}
