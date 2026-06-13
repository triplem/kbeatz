import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DismissibleBanner } from '../../lib/dismissible-banner'
import { ScanErrors } from './scan-errors'
import { formatDateTime } from '../../lib/i18n'
import { useScanStatus } from './useScanStatus'
import styles from './scan-progress.module.css'

/**
 * Dismissible completion banner for a single scan epoch.
 *
 * Keyed on `completedAt` so React automatically resets dismissed state when a
 * new scan completes (a new key means a fresh component instance).
 */
interface CompletedBannerProps {
  readonly completedAt: string
}

function CompletedBanner({ completedAt }: CompletedBannerProps) {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <DismissibleBanner
      className={`${styles.scanProgress} ${styles.completed}`}
      role="status"
      onDismiss={() => { setDismissed(true) }}
    >
      {t('scanProgress.completedAt', { time: formatDateTime(completedAt) })}
    </DismissibleBanner>
  )
}

/**
 * Scan progress banner.
 *
 * Polls `GET /api/v1/library/scan/status` every 2 seconds while state is RUNNING.
 * Displays a banner with the current progress count and started-at timestamp.
 * When COMPLETED shows the completed-at timestamp with a dismiss button.
 * When COMPLETED with per-album errors, shows the ScanErrors banner below.
 * When IDLE, renders nothing. Shows an error message when state is FAILED.
 *
 * Dismissal is React-state only: the notification reappears after a page refresh
 * because `completedAt` is re-fetched from the API on mount. Each new scan
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
    return (
      <>
        {status.completedAt && (
          <CompletedBanner key={status.completedAt} completedAt={status.completedAt} />
        )}
        {hasErrors && (
          <ScanErrors
            errors={status.errors ?? []}
            totalErrors={status.totalErrors ?? 0}
          />
        )}
      </>
    )
  }

  if (status.state === 'FAILED') {
    return (
      <div className={`${styles.scanProgress} ${styles.failed}`} role="alert">
        {t('scanProgress.failed', { message: status.errorMessage ?? t('scanProgress.unknownError') })}
      </div>
    )
  }

  // RUNNING
  const scanned = status.scannedAlbums ?? 0
  const total = status.totalAlbums
  const progressText = total !== undefined ? `${scanned} / ${total}` : `${scanned}`

  return (
    <div
      className={`${styles.scanProgress} ${styles.running}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {t('scanProgress.running', { progress: progressText })}
      {status.startedAt && (
        <span className={styles.timestamp}>
          {' '}{t('scanProgress.startedAt', { time: formatDateTime(status.startedAt) })}
        </span>
      )}
    </div>
  )
}
