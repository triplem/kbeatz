import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ScanProgress } from './scan-progress'
import type { ScanStatus } from '../../api/generated'

// Mock the LibraryService
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

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
}

function renderScanProgress() {
  const queryClient = makeQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <ScanProgress />
    </QueryClientProvider>,
  )
}

describe('ScanProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders nothing when status is IDLE', async () => {
    mockGetStatus.mockResolvedValue(makeStatus('IDLE'))
    const { container } = renderScanProgress()
    await waitFor(() => { expect(mockGetStatus).toHaveBeenCalled() })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when status is COMPLETED without completedAt', async () => {
    mockGetStatus.mockResolvedValue(makeStatus('COMPLETED'))
    const { container } = renderScanProgress()
    await waitFor(() => { expect(mockGetStatus).toHaveBeenCalled() })
    expect(container.firstChild).toBeNull()
  })

  it('renders completed timestamp when status is COMPLETED with completedAt', async () => {
    mockGetStatus.mockResolvedValue(
      makeStatus('COMPLETED', { completedAt: '2026-06-09T20:31:20Z' }),
    )
    renderScanProgress()
    const banner = await screen.findByRole('status')
    expect(banner).toBeInTheDocument()
    // Should contain the year from the formatted timestamp
    expect(banner.textContent).toContain('2026')
  })

  it('renders startedAt timestamp in running banner when present', async () => {
    mockGetStatus.mockResolvedValue(
      makeStatus('RUNNING', { scannedAlbums: 10, totalAlbums: 100, startedAt: '2026-06-09T20:00:00Z' }),
    )
    renderScanProgress()
    const banner = await screen.findByRole('status')
    expect(banner.textContent).toContain('2026')
  })

  it('renders progress banner when status is RUNNING', async () => {
    mockGetStatus.mockResolvedValue(
      makeStatus('RUNNING', { scannedAlbums: 100, totalAlbums: 500 }),
    )
    renderScanProgress()
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Scanning: 100 / 500 albums')
    })
  })

  it('running banner has aria-live="polite" and aria-atomic="true"', async () => {
    mockGetStatus.mockResolvedValue(
      makeStatus('RUNNING', { scannedAlbums: 5, totalAlbums: 50 }),
    )
    renderScanProgress()
    const banner = await screen.findByRole('status')
    expect(banner).toHaveAttribute('aria-live', 'polite')
    expect(banner).toHaveAttribute('aria-atomic', 'true')
  })

  it('renders progress without total when totalAlbums is not set', async () => {
    mockGetStatus.mockResolvedValue(makeStatus('RUNNING', { scannedAlbums: 42 }))
    renderScanProgress()
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Scanning: 42 albums')
    })
  })

  it('renders error banner when status is FAILED', async () => {
    mockGetStatus.mockResolvedValue(makeStatus('FAILED', { errorMessage: 'Disk full' }))
    renderScanProgress()
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Scan failed: Disk full')
    })
  })

  it('renders generic error when FAILED with no errorMessage', async () => {
    mockGetStatus.mockResolvedValue(makeStatus('FAILED'))
    renderScanProgress()
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Scan failed: Unknown error')
    })
  })

  it('polls every 2 seconds while RUNNING', async () => {
    mockGetStatus.mockResolvedValue(makeStatus('RUNNING', { scannedAlbums: 0 }))
    renderScanProgress()

    // Wait for first poll
    await waitFor(() => expect(mockGetStatus).toHaveBeenCalledTimes(1))

    // Advance 2s to trigger second poll
    await vi.advanceTimersByTimeAsync(2000)
    expect(mockGetStatus).toHaveBeenCalledTimes(2)

    // Advance another 2s to trigger third poll
    await vi.advanceTimersByTimeAsync(2000)
    expect(mockGetStatus).toHaveBeenCalledTimes(3)
  })

  it('stops polling when status transitions to COMPLETED', async () => {
    mockGetStatus
      .mockResolvedValueOnce(makeStatus('RUNNING', { scannedAlbums: 100 }))
      .mockResolvedValueOnce(makeStatus('COMPLETED'))

    renderScanProgress()
    await waitFor(() => expect(mockGetStatus).toHaveBeenCalledTimes(1))

    // Advance 2s to trigger second poll (COMPLETED)
    await vi.advanceTimersByTimeAsync(2000)
    expect(mockGetStatus).toHaveBeenCalledTimes(2)

    // Advance much further - should NOT trigger more polls
    await vi.advanceTimersByTimeAsync(10000)
    // Still only 2 calls
    expect(mockGetStatus).toHaveBeenCalledTimes(2)
  })

  it('stops polling when status transitions to FAILED', async () => {
    mockGetStatus
      .mockResolvedValueOnce(makeStatus('RUNNING', { scannedAlbums: 50 }))
      .mockResolvedValueOnce(makeStatus('FAILED', { errorMessage: 'Permission denied' }))

    renderScanProgress()
    await waitFor(() => expect(mockGetStatus).toHaveBeenCalledTimes(1))

    await vi.advanceTimersByTimeAsync(2000)
    expect(mockGetStatus).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(10000)
    expect(mockGetStatus).toHaveBeenCalledTimes(2)
  })

  it('updates progress count on each poll', async () => {
    mockGetStatus
      .mockResolvedValueOnce(makeStatus('RUNNING', { scannedAlbums: 10, totalAlbums: 100 }))
      .mockResolvedValueOnce(makeStatus('RUNNING', { scannedAlbums: 50, totalAlbums: 100 }))

    renderScanProgress()
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Scanning: 10 / 100 albums')
    })

    // Advance 2s to trigger second poll
    await vi.advanceTimersByTimeAsync(2000)
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Scanning: 50 / 100 albums')
    })
  })
})
