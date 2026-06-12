import { useTranslation } from 'react-i18next'
import { useScanStatus } from './useScanStatus'
import { formatDateTime } from '../../lib/i18n'
import styles from './scan-progress.module.css'

/**
 * Scan progress banner.
 *
 * Polls `GET /api/v1/library/scan/status` every 2 seconds while state is RUNNING.
 * Displays a banner with the current progress count and started-at timestamp.
 * When COMPLETED shows the completed-at timestamp. When IDLE, renders nothing.
 * Shows an error message when state is FAILED.
 * Does not render when state is IDLE.
 */
export function ScanProgress() {
  const { t } = useTranslation()
  const { status } = useScanStatus()


  if (status === undefined || status.state === 'IDLE') {
    return null
  }

  if (status.state === 'COMPLETED') {
    return status.completedAt ? (
      <div className={`${styles.scanProgress} ${styles.completed}`} role="status">
        {t('scanProgress.completedAt', { time: formatDateTime(status.completedAt) })}
      </div>
    ) : null
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
