import { useCallback, useEffect, useRef, useState } from 'react'
import { ScanStatus } from '../../api/generated'
import { LibraryService } from '../../api/generated'

const POLL_INTERVAL_MS = 2000

/**
 * Scan progress banner.
 *
 * Polls `GET /api/v1/library/scan/status` every 2 seconds while state is RUNNING.
 * Displays a banner with the current progress count.
 * Disappears when the scan completes or was never started (IDLE).
 * Shows an error message when state is FAILED.
 * Does not render at all when state is IDLE or COMPLETED.
 */
export function ScanProgress() {
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

  if (status === null || status.state === 'IDLE' || status.state === 'COMPLETED') {
    return null
  }

  if (status.state === 'FAILED') {
    return (
      <div className="scan-progress scan-progress--failed" role="alert">
        Scan failed: {status.errorMessage ?? 'Unknown error'}
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
      Scanning: {progressText} albums
    </div>
  )
}
