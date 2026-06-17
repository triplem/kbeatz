import { useTranslation } from 'react-i18next'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import LinearProgress from '@mui/material/LinearProgress'
import Typography from '@mui/material/Typography'
import { ScanErrors } from './scan-errors'
import { formatDateTime } from '../../lib/i18n'
import { useScanStatus } from './useScanStatus'
import { useScanBannerDismissal } from './useScanBannerDismissal'

/**
 * Dismissible completion banner for a single scan epoch.
 *
 * Keyed on `completedAt` so React automatically resets dismissed state when a
 * new scan completes (a new key means a fresh component instance).
 *
 * Dismissal is persisted to localStorage so the banner does not reappear after
 * a page reload. A different `completedAt` value (new scan) always shows the
 * banner once regardless of prior dismissals.
 */
interface CompletedBannerProps {
  readonly completedAt: string
}

function CompletedBanner({ completedAt }: CompletedBannerProps) {
  const { t } = useTranslation()
  const { isDismissed, dismiss } = useScanBannerDismissal(completedAt)

  if (isDismissed) return null

  return (
    <Alert
      severity="success"
      role="status"
      onClose={dismiss}
      slotProps={{ closeButton: { 'aria-label': t('common.dismiss') } }}
    >
      {t('scanProgress.completedAt', { time: formatDateTime(completedAt) })}
    </Alert>
  )
}

/**
 * Scan progress banner.
 *
 * Rebuilt on MUI feedback components (LinearProgress, Alert). Polls
 * `GET /api/v1/library/scan/status` every 2 seconds while state is RUNNING.
 * Displays a determinate/indeterminate progress bar with the current count and
 * started-at timestamp. When COMPLETED shows a dismissible success Alert. When
 * COMPLETED with per-album errors, shows the ScanErrors banner below. When IDLE,
 * renders nothing. Shows an error Alert when state is FAILED.
 *
 * Dismissal is persisted via useScanBannerDismissal (localStorage). Each new scan
 * completion produces a new `completedAt` value which resets the dismissed state
 * automatically via the React key on `CompletedBanner`.
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
    // Nothing to surface (no completion timestamp and no errors): render nothing
    // so the global banner area stays empty.
    if (!hasCompletedAt && !hasErrors) {
      return null
    }
    // A Fragment (not a Box wrapper) is used so the rendered output collapses to
    // nothing once the completion banner is dismissed and there are no errors -
    // the global banner area must not leave an empty container behind.
    return (
      <>
        {status.completedAt && (
          <CompletedBanner key={status.completedAt} completedAt={status.completedAt} />
        )}
        {hasErrors && (
          <Box sx={{ mt: status.completedAt ? 1 : 0 }}>
            <ScanErrors
              errors={status.errors ?? []}
              totalErrors={status.totalErrors ?? 0}
            />
          </Box>
        )}
      </>
    )
  }

  if (status.state === 'FAILED') {
    return (
      <Alert severity="error" role="alert">
        {t('scanProgress.failed', { message: status.errorMessage ?? t('scanProgress.unknownError') })}
      </Alert>
    )
  }

  // RUNNING
  const scanned = status.scannedAlbums ?? 0
  const total = status.totalAlbums
  const progressText = total !== undefined ? `${scanned} / ${total}` : `${scanned}`
  // Determinate bar when total is known; otherwise an indeterminate bar.
  const hasTotal = total !== undefined && total > 0
  const progressValue = hasTotal ? Math.min(100, Math.round((scanned / total) * 100)) : undefined

  return (
    <Box
      role="status"
      aria-live="polite"
      aria-atomic="true"
      sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}
    >
      <Typography variant="body2" component="p" sx={{ m: 0 }}>
        {t('scanProgress.running', { progress: progressText })}
        {status.startedAt && (
          <Box component="span">
            {' '}{t('scanProgress.startedAt', { time: formatDateTime(status.startedAt) })}
          </Box>
        )}
      </Typography>
      {/*
        Determinate bar is exposed as a real progressbar so assistive tech can
        read the current percentage on demand (WCAG 1.3.1 / 4.1.2). The
        indeterminate bar carries no value, so it stays aria-hidden (it would
        otherwise announce a meaningless progressbar with no value).
      */}
      <LinearProgress
        variant={hasTotal ? 'determinate' : 'indeterminate'}
        value={progressValue}
        aria-hidden={hasTotal ? undefined : 'true'}
        aria-label={hasTotal ? t('scanProgress.running', { progress: progressText }) : undefined}
      />
    </Box>
  )
}
