import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement } from 'react'
import { useScanStatus } from './useScanStatus'
import type { ScanStatus } from '../../api/generated'

vi.mock('../../api/generated', () => ({
  LibraryService: {
    getLibraryScanStatus: vi.fn(),
  },
}))

import { LibraryService } from '../../api/generated'
const mockGetStatus = vi.mocked(LibraryService.getLibraryScanStatus)

function makeStatus(
  state: ScanStatus['state'],
  overrides: Partial<ScanStatus> = {},
): ScanStatus {
  return { state, ...overrides }
}

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

// State assertion tests - real timers
describe('useScanStatus - state assertions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns undefined status initially while fetching', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetStatus.mockReturnValue(new Promise(() => undefined) as any)
    const { result } = renderHook(() => useScanStatus(), { wrapper: makeWrapper() })
    expect(result.current.status).toBeUndefined()
    expect(result.current.isRunning).toBe(false)
  })

  it('returns status after the query resolves', async () => {
    mockGetStatus.mockResolvedValue(makeStatus('IDLE'))
    const { result } = renderHook(() => useScanStatus(), { wrapper: makeWrapper() })

    await waitFor(() => {
      expect(result.current.status).toBeDefined()
    })

    expect(result.current.status?.state).toBe('IDLE')
    expect(result.current.isRunning).toBe(false)
  })

  it('returns isRunning=true when state is RUNNING', async () => {
    mockGetStatus.mockResolvedValue(makeStatus('RUNNING', { scannedAlbums: 10, totalAlbums: 100 }))
    const { result } = renderHook(() => useScanStatus(), { wrapper: makeWrapper() })

    await waitFor(() => {
      expect(result.current.isRunning).toBe(true)
    })
  })

  it('returns isRunning=false when state is COMPLETED', async () => {
    mockGetStatus.mockResolvedValue(makeStatus('COMPLETED', { completedAt: '2026-06-01T10:00:00Z' }))
    const { result } = renderHook(() => useScanStatus(), { wrapper: makeWrapper() })

    await waitFor(() => {
      expect(result.current.status?.state).toBe('COMPLETED')
    })

    expect(result.current.isRunning).toBe(false)
  })

  it('returns isError=true when the query rejects', async () => {
    mockGetStatus.mockRejectedValue(new Error('Network failure'))
    const { result } = renderHook(() => useScanStatus(), { wrapper: makeWrapper() })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
  })

  it('returns named fields (not a tuple)', async () => {
    mockGetStatus.mockResolvedValue(makeStatus('IDLE'))
    const { result } = renderHook(() => useScanStatus(), { wrapper: makeWrapper() })

    await waitFor(() => {
      expect(result.current.status).toBeDefined()
    })

    expect(result.current).toHaveProperty('status')
    expect(result.current).toHaveProperty('isRunning')
    expect(result.current).toHaveProperty('isError')
    expect(Array.isArray(result.current)).toBe(false)
  })
})

// Polling behaviour tests - fake timers
describe('useScanStatus - polling behaviour', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('polls every 2 seconds when RUNNING', async () => {
    mockGetStatus.mockResolvedValue(makeStatus('RUNNING', { scannedAlbums: 0, totalAlbums: 100 }))
    renderHook(() => useScanStatus(), { wrapper: makeWrapper() })

    // Flush initial fetch
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockGetStatus).toHaveBeenCalledTimes(1)

    await act(async () => {
      vi.advanceTimersByTime(2000)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockGetStatus).toHaveBeenCalledTimes(2)

    await act(async () => {
      vi.advanceTimersByTime(2000)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockGetStatus).toHaveBeenCalledTimes(3)
  })

  it('stops polling when state transitions to COMPLETED', async () => {
    mockGetStatus
      .mockResolvedValueOnce(makeStatus('RUNNING', { scannedAlbums: 50 }))
      .mockResolvedValueOnce(makeStatus('COMPLETED', { completedAt: '2026-06-01T10:00:00Z' }))

    renderHook(() => useScanStatus(), { wrapper: makeWrapper() })

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    // Trigger a second poll
    await act(async () => {
      vi.advanceTimersByTime(2000)
      await Promise.resolve()
      await Promise.resolve()
    })

    // After COMPLETED the interval should stop
    await act(async () => {
      vi.advanceTimersByTime(4000)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockGetStatus).toHaveBeenCalledTimes(2)
  })
})
