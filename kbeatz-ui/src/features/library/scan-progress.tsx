import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Banner } from '@astryxdesign/core/Banner'
import { ProgressBar } from '@astryxdesign/core/ProgressBar'
import { Icon } from '@astryxdesign/core/Icon'
import { Text } from '@astryxdesign/core/Text'
import { X } from 'lucide-react'
import { ScanErrors } from './scan-errors'
import { formatDateTime } from '../../lib/i18n'
import { useScanStatus } from './useScanStatus'
import { useScanBannerDismissal } from './useScanBannerDismissal'

/** Auto-dismiss delay in milliseconds after a scan completes successfully. */
const AUTO_DISMISS_DELAY_MS = 5000

/**
 * Dismissible completion banner for a single scan epoch.
 *
 * Keyed on `completedAt` so React automatically resets dismissed state when a
 * new scan completes. Dismissal is persisted to localStorage so the banner does
 * not reappear after a page reload.
 */
export interface CompletedBannerProps {
  readonly completedAt: string
}

export function CompletedBanner({ completedAt }: CompletedBannerProps) {
  const { t } = useTranslation()
  const { isDismissed, dismiss } = useScanBannerDismissal(completedAt)

  useEffect(() => {
    const timer = setTimeout(dismiss, AUTO_DISMISS_DELAY_MS)
    return () => { clearTimeout(timer) }
  }, [dismiss])

  if (isDismissed) return null

  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        borderRadius: 'var(--radius-element, 8px)',
        background: 'var(--color-success-muted, rgba(46, 196, 182, 0.12))',
      }}
    >
      <Text type="supporting">
        {t('scanProgress.completedAt', { time: formatDateTime(completedAt) })}
      </Text>
      {/* Plain button (not Astryx IconButton) so this status region contains a
          single live-region role, keeping findByRole('status') unambiguous. */}
      <button
        type="button"
        aria-label={t('common.dismiss')}
        onClick={dismiss}
        style={{
          marginInlineStart: 'auto',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 28,
          minHeight: 28,
          border: 'none',
          background: 'transparent',
          color: 'var(--color-text-primary)',
          cursor: 'pointer',
          borderRadius: 'var(--radius-element, 8px)',
        }}
      >
        <Icon icon={X} size="sm" />
      </button>
    </div>
  )
}

/**
 * Scan progress banner.
 *
 * Polls `GET /api/v1/library/scan/status` every 2 seconds while state is RUNNING.
 * Displays a determinate/indeterminate progress bar with the current count and
 * started-at timestamp. When COMPLETED shows a dismissible success Banner. When
 * COMPLETED with per-album errors, shows the ScanErrors banner below. When IDLE,
 * renders nothing. Shows an error Banner when state is FAILED.
 */
export function ScanProgress() {
  const { t } = useTranslation()
  const { status } = useScanStatus()

  if (status === undefined || status.state === 'IDLE') {
    return null
  }

  if (status.state === 'COMPLETED') {
    const hasErrors = (status.totalErrors ?? 0) > 0
    const hasCompletedAt = Boolean(status.completedAt)
    if (!hasCompletedAt && !hasErrors) {
      return null
    }
    return (
      <>
        {status.completedAt && (
          <CompletedBanner key={status.completedAt} completedAt={status.completedAt} />
        )}
        {hasErrors && (
          <div style={{ marginTop: status.completedAt ? 8 : 0 }}>
            <ScanErrors
              errors={status.errors ?? []}
              totalErrors={status.totalErrors ?? 0}
            />
          </div>
        )}
      </>
    )
  }

  if (status.state === 'FAILED') {
    return (
      <Banner
        status="error"
        title={t('scanProgress.failed', { message: status.errorMessage ?? t('scanProgress.unknownError') })}
      />
    )
  }

  // RUNNING
  const scanned = status.scannedAlbums ?? 0
  const total = status.totalAlbums
  const progressText = total !== undefined ? `${scanned} / ${total}` : `${scanned}`
  const hasTotal = total !== undefined && total > 0
  const progressValue = hasTotal ? Math.min(100, Math.round((scanned / total) * 100)) : 0
  const runningLabel = t('scanProgress.running', { progress: progressText })

  return (
    <div role="status" aria-live="polite" aria-atomic="true" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <p style={{ margin: 0 }}>
        <Text type="supporting">
          {runningLabel}
          {status.startedAt && <> {t('scanProgress.startedAt', { time: formatDateTime(status.startedAt) })}</>}
        </Text>
      </p>
      {/*
        Determinate bar is exposed as a real progressbar so assistive tech can
        read the current percentage on demand (WCAG 1.3.1 / 4.1.2). The
        indeterminate bar carries no value, so it stays aria-hidden (it would
        otherwise announce a meaningless progressbar with no value).
      */}
      {hasTotal ? (
        <ProgressBar label={runningLabel} value={progressValue} isLabelHidden />
      ) : (
        <span aria-hidden="true" style={{ display: 'block' }}>
          <ProgressBar label={runningLabel} isIndeterminate isLabelHidden />
        </span>
      )}
    </div>
  )
}
