import { useQuery } from '@tanstack/react-query'
import { LibraryService, type ScanStatus } from '../../api/generated'

const POLL_INTERVAL_MS = 2000

interface UseScanStatusResult {
  readonly status: ScanStatus | undefined
  readonly isRunning: boolean
  readonly isError: boolean
}

/**
 * Poll the library scan status endpoint.
 *
 * Polling fires every 2 seconds while state is RUNNING and stops
 * automatically once the scan reaches COMPLETED, FAILED, or IDLE.
 *
 * Query key: ['scan-status']
 */
export function useScanStatus(): UseScanStatusResult {
  const { data: status, isError } = useQuery<ScanStatus, Error>({
    queryKey: ['scan-status'],
    queryFn: () => LibraryService.getLibraryScanStatus(),
    refetchInterval: (query) => {
      return query.state.data?.state === 'RUNNING' ? POLL_INTERVAL_MS : false
    },
  })

  return {
    status,
    isRunning: status?.state === 'RUNNING',
    isError,
  }
}
