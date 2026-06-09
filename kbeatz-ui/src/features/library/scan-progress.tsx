import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScanStatus } from '../../api/generated'
import { LibraryService } from '../../api/generated'
import { formatDateTime } from '../../lib/i18n'

const POLL_INTERVAL_MS = 2000

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
  const [status, setStatus] = useState<ScanStatus | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const fetchStatus = useCallback(async () => {
    try {
      const s = await LibraryService.getLibraryScanStatus()
      setStatus(s)
      if (s.state !== 'RUNNING') {
        stopPolling()
      }
    } catch {
      stopPolling()
    }
  }, [stopPolling])

  useEffect(() => {
    void fetchStatus()

    intervalRef.current = setInterval(() => {
      void fetchStatus()
    }, POLL_INTERVAL_MS)

    return stopPolling
  }, [fetchStatus, stopPolling])

  if (status === null || status.state === 'IDLE') {
    return null
  }

  if (status.state === 'COMPLETED') {
    return status.completedAt ? (
      <div className="scan-progress scan-progress--completed" role="status">
        {t('scanProgress.completedAt', { time: formatDateTime(status.completedAt) })}
      </div>
    ) : null
  }

  if (status.state === 'FAILED') {
    return (
      <div className="scan-progress scan-progress--failed" role="alert">
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
      className="scan-progress scan-progress--running"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {t('scanProgress.running', { progress: progressText })}
      {status.startedAt && (
        <span className="scan-progress__timestamp">
          {' '}{t('scanProgress.startedAt', { time: formatDateTime(status.startedAt) })}
        </span>
      )}
    </div>
  )
}
