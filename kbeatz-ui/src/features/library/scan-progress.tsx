import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DismissibleBanner } from '../../lib/dismissible-banner'
import { formatDateTime } from '../../lib/i18n'
import { useScanStatus } from './useScanStatus'
import styles from './scan-progress.module.css'

/**
 * Scan progress banner.
 *
 * Polls `GET /api/v1/library/scan/status` every 2 seconds while state is RUNNING.
 * Displays a banner with the current progress count and started-at timestamp.
 * When COMPLETED shows the completed-at timestamp with a dismiss button.
 * When IDLE, renders nothing. Shows an error message when state is FAILED.
 * Does not render when state is IDLE.
 *
 * Dismissal is React-state only: the notification reappears after a page refresh
 * because `completedAt` is re-fetched from the API on mount. If the scan transitions
 * from COMPLETED back to RUNNING (a new scan starts) the dismissed flag resets so
 * the next completion notification is shown automatically.
 */
export function ScanProgress() {
  const { t } = useTranslation()
  const { status } = useScanStatus()
  const [dismissed, setDismissed] = useState(false)

  // Reset dismissed flag whenever a new scan starts so the next completion
  // notification is shown without requiring a page refresh.
  useEffect(() => {
    if (status?.state === 'RUNNING') {
      setDismissed(false)
    }
  }, [status?.state])

  if (status === undefined || status.state === 'IDLE') {
    return null
  }

  if (status.state === 'COMPLETED') {
    if (dismissed || !status.completedAt) return null
    return (
      <DismissibleBanner
        className={`${styles.scanProgress} ${styles.completed}`}
        role="status"
        onDismiss={() => { setDismissed(true) }}
      >
        {t('scanProgress.completedAt', { time: formatDateTime(status.completedAt) })}
      </DismissibleBanner>
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
