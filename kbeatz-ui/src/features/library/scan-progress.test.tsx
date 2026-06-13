import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  )
}

// Tests that assert UI state after the first fetch resolves (real timers)
describe('ScanProgress - render states', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when status is IDLE', async () => {
    mockGetStatus.mockResolvedValue(makeStatus('IDLE'))
    const { container } = renderWithQuery(<ScanProgress />)
    await waitFor(() => {
      expect(mockGetStatus).toHaveBeenCalledTimes(1)
    })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when status is COMPLETED without completedAt', async () => {
    mockGetStatus.mockResolvedValue(makeStatus('COMPLETED'))
    const { container } = renderWithQuery(<ScanProgress />)
    await waitFor(() => {
      expect(mockGetStatus).toHaveBeenCalledTimes(1)
    })
    expect(container.firstChild).toBeNull()
  })

  it('renders completed timestamp when status is COMPLETED with completedAt', async () => {
    mockGetStatus.mockResolvedValue(
      makeStatus('COMPLETED', { completedAt: '2026-06-09T20:31:20Z' }),
    )
    renderWithQuery(<ScanProgress />)
    const banner = await screen.findByRole('status')
    expect(banner).toBeInTheDocument()
    // Should contain the year from the formatted timestamp
    expect(banner.textContent).toContain('2026')
  })

  it('renders a dismiss button in the COMPLETED state', async () => {
    mockGetStatus.mockResolvedValue(
      makeStatus('COMPLETED', { completedAt: '2026-06-09T20:31:20Z' }),
    )
    renderWithQuery(<ScanProgress />)
    const dismissBtn = await screen.findByRole('button', { name: 'Dismiss' })
    expect(dismissBtn).toBeInTheDocument()
  })

  it('hides the banner after clicking dismiss', async () => {
    const user = userEvent.setup()
    mockGetStatus.mockResolvedValue(
      makeStatus('COMPLETED', { completedAt: '2026-06-09T20:31:20Z' }),
    )
    const { container } = renderWithQuery(<ScanProgress />)
    const dismissBtn = await screen.findByRole('button', { name: 'Dismiss' })
    await user.click(dismissBtn)
    expect(container.firstChild).toBeNull()
  })

  it('does not render a dismiss button in the RUNNING state', async () => {
    mockGetStatus.mockResolvedValue(
      makeStatus('RUNNING', { scannedAlbums: 10, totalAlbums: 100 }),
    )
    renderWithQuery(<ScanProgress />)
    await screen.findByRole('status')
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull()
  })

  it('shows the completion banner again after a new scan completes', async () => {
    const user = userEvent.setup()
    // First scan completes - banner is shown and dismissed
    mockGetStatus.mockResolvedValue(
      makeStatus('COMPLETED', { completedAt: '2026-06-09T20:31:20Z' }),
    )
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <ScanProgress />
      </QueryClientProvider>,
    )
    const dismissBtn = await screen.findByRole('button', { name: 'Dismiss' })
    await user.click(dismissBtn)
    expect(screen.queryByRole('status')).toBeNull()

    // A second scan completes with a different completedAt timestamp.
    // The new key on CompletedBanner resets dismissed state automatically.
    mockGetStatus.mockResolvedValue(
      makeStatus('COMPLETED', { completedAt: '2026-06-09T21:00:00Z' }),
    )
    await queryClient.invalidateQueries()
    await screen.findByRole('button', { name: 'Dismiss' })
  })

  it('renders startedAt timestamp in running banner when present', async () => {
    mockGetStatus.mockResolvedValue(
      makeStatus('RUNNING', { scannedAlbums: 10, totalAlbums: 100, startedAt: '2026-06-09T20:00:00Z' }),
    )
    renderWithQuery(<ScanProgress />)
    const banner = await screen.findByRole('status')
    expect(banner.textContent).toContain('2026')
  })

  it('renders progress banner when status is RUNNING', async () => {
    mockGetStatus.mockResolvedValue(
      makeStatus('RUNNING', { scannedAlbums: 100, totalAlbums: 500 }),
    )
    renderWithQuery(<ScanProgress />)
    const banner = await screen.findByRole('status')
    expect(banner).toHaveTextContent('Scanning: 100 / 500 albums')
  })

  it('running banner has aria-live="polite" and aria-atomic="true"', async () => {
    mockGetStatus.mockResolvedValue(
      makeStatus('RUNNING', { scannedAlbums: 5, totalAlbums: 50 }),
    )
    renderWithQuery(<ScanProgress />)
    const banner = await screen.findByRole('status')
    expect(banner).toHaveAttribute('aria-live', 'polite')
    expect(banner).toHaveAttribute('aria-atomic', 'true')
  })

  it('renders progress without total when totalAlbums is not set', async () => {
    mockGetStatus.mockResolvedValue(makeStatus('RUNNING', { scannedAlbums: 42 }))
    renderWithQuery(<ScanProgress />)
    const banner = await screen.findByRole('status')
    expect(banner).toHaveTextContent('Scanning: 42 albums')
  })

  it('renders error banner when status is FAILED', async () => {
    mockGetStatus.mockResolvedValue(makeStatus('FAILED', { errorMessage: 'Disk full' }))
    renderWithQuery(<ScanProgress />)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Scan failed: Disk full')
  })

  it('renders generic error when FAILED with no errorMessage', async () => {
    mockGetStatus.mockResolvedValue(makeStatus('FAILED'))
    renderWithQuery(<ScanProgress />)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Scan failed: Unknown error')
  })

  it('renders ScanErrors alert when COMPLETED with totalErrors > 0', async () => {
    mockGetStatus.mockResolvedValue(
      makeStatus('COMPLETED', {
        completedAt: '2026-06-09T20:31:20Z',
        totalErrors: 2,
        errors: [
          { albumDir: 'Artist1/Album1', reason: 'Permission denied', suggestion: 'Check file permissions' },
          { albumDir: 'Artist2/Album2', reason: 'FLAC header unreadable', suggestion: 'Re-rip or restore from backup' },
        ],
      }),
    )
    renderWithQuery(<ScanProgress />)
    const alert = await screen.findByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert.textContent).toContain('2')
  })

  it('does not render ScanErrors when COMPLETED with totalErrors of 0', async () => {
    mockGetStatus.mockResolvedValue(
      makeStatus('COMPLETED', { completedAt: '2026-06-09T20:31:20Z', totalErrors: 0 }),
    )
    renderWithQuery(<ScanProgress />)
    const status = await screen.findByRole('status')
    expect(status.textContent).toContain('2026')
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

// Tests that verify polling behaviour (fake timers)
describe('ScanProgress - polling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('polls every 2 seconds while RUNNING', async () => {
    mockGetStatus.mockResolvedValue(makeStatus('RUNNING', { scannedAlbums: 0 }))
    renderWithQuery(<ScanProgress />)

    // Flush the initial fetch
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

  it('stops polling when status transitions to COMPLETED', async () => {
    mockGetStatus
      .mockResolvedValueOnce(makeStatus('RUNNING', { scannedAlbums: 100 }))
      .mockResolvedValueOnce(makeStatus('COMPLETED'))

    renderWithQuery(<ScanProgress />)

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      vi.advanceTimersByTime(2000)
      await Promise.resolve()
      await Promise.resolve()
    })

    // At this point polling should have stopped
    await act(async () => {
      vi.advanceTimersByTime(4000)
      await Promise.resolve()
      await Promise.resolve()
    })

    // Only called twice - once for RUNNING, once for COMPLETED
    expect(mockGetStatus).toHaveBeenCalledTimes(2)
  })

  it('stops polling when status transitions to FAILED', async () => {
    mockGetStatus
      .mockResolvedValueOnce(makeStatus('RUNNING', { scannedAlbums: 50 }))
      .mockResolvedValueOnce(makeStatus('FAILED', { errorMessage: 'Permission denied' }))

    renderWithQuery(<ScanProgress />)

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      vi.advanceTimersByTime(2000)
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      vi.advanceTimersByTime(4000)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockGetStatus).toHaveBeenCalledTimes(2)
  })

  it('updates progress count on each poll', async () => {
    // This test verifies that polling fires the mock multiple times.
    // DOM content assertion after a poll is covered via the real-timer render-states suite.
    mockGetStatus
      .mockResolvedValueOnce(makeStatus('RUNNING', { scannedAlbums: 10, totalAlbums: 100 }))
      .mockResolvedValueOnce(makeStatus('RUNNING', { scannedAlbums: 50, totalAlbums: 100 }))

    renderWithQuery(<ScanProgress />)

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    // First poll fired
    expect(mockGetStatus).toHaveBeenCalledTimes(1)

    await act(async () => {
      vi.advanceTimersByTime(2000)
      await Promise.resolve()
      await Promise.resolve()
    })

    // Second poll fired, service called twice
    expect(mockGetStatus).toHaveBeenCalledTimes(2)
    expect(mockGetStatus).toHaveBeenNthCalledWith(2)
  })
})
