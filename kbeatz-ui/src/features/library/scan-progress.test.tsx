import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

describe('ScanProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders nothing when status is IDLE', async () => {
    mockGetStatus.mockResolvedValue(makeStatus('IDLE'))
    const { container } = render(<ScanProgress />)
    await act(async () => {
      await Promise.resolve()
    })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when status is COMPLETED without completedAt', async () => {
    mockGetStatus.mockResolvedValue(makeStatus('COMPLETED'))
    const { container } = render(<ScanProgress />)
    await act(async () => {
      await Promise.resolve()
    })
    expect(container.firstChild).toBeNull()
  })

  it('renders completed timestamp when status is COMPLETED with completedAt', async () => {
    mockGetStatus.mockResolvedValue(
      makeStatus('COMPLETED', { completedAt: '2026-06-09T20:31:20Z' }),
    )
    render(<ScanProgress />)
    await act(async () => {
      await Promise.resolve()
    })
    const banner = screen.getByRole('status')
    expect(banner).toBeInTheDocument()
    // Should contain the year from the formatted timestamp
    expect(banner.textContent).toContain('2026')
  })

  it('renders startedAt timestamp in running banner when present', async () => {
    mockGetStatus.mockResolvedValue(
      makeStatus('RUNNING', { scannedAlbums: 10, totalAlbums: 100, startedAt: '2026-06-09T20:00:00Z' }),
    )
    render(<ScanProgress />)
    await act(async () => {
      await Promise.resolve()
    })
    const banner = screen.getByRole('status')
    expect(banner.textContent).toContain('2026')
  })

  it('renders progress banner when status is RUNNING', async () => {
    mockGetStatus.mockResolvedValue(
      makeStatus('RUNNING', { scannedAlbums: 100, totalAlbums: 500 }),
    )
    render(<ScanProgress />)
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByRole('status')).toHaveTextContent('Scanning: 100 / 500 albums')
  })

  it('running banner has aria-live="polite" and aria-atomic="true"', async () => {
    mockGetStatus.mockResolvedValue(
      makeStatus('RUNNING', { scannedAlbums: 5, totalAlbums: 50 }),
    )
    render(<ScanProgress />)
    await act(async () => {
      await Promise.resolve()
    })
    const banner = screen.getByRole('status')
    expect(banner).toHaveAttribute('aria-live', 'polite')
    expect(banner).toHaveAttribute('aria-atomic', 'true')
  })

  it('renders progress without total when totalAlbums is not set', async () => {
    mockGetStatus.mockResolvedValue(makeStatus('RUNNING', { scannedAlbums: 42 }))
    render(<ScanProgress />)
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByRole('status')).toHaveTextContent('Scanning: 42 albums')
  })

  it('renders error banner when status is FAILED', async () => {
    mockGetStatus.mockResolvedValue(makeStatus('FAILED', { errorMessage: 'Disk full' }))
    render(<ScanProgress />)
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Scan failed: Disk full')
  })

  it('renders generic error when FAILED with no errorMessage', async () => {
    mockGetStatus.mockResolvedValue(makeStatus('FAILED'))
    render(<ScanProgress />)
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Scan failed: Unknown error')
  })

  it('polls every 2 seconds while RUNNING', async () => {
    mockGetStatus.mockResolvedValue(makeStatus('RUNNING', { scannedAlbums: 0 }))
    render(<ScanProgress />)
    await act(async () => {
      await Promise.resolve()
    })
    expect(mockGetStatus).toHaveBeenCalledTimes(1)

    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(mockGetStatus).toHaveBeenCalledTimes(2)

    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(mockGetStatus).toHaveBeenCalledTimes(3)
  })

  it('stops polling when status transitions to COMPLETED', async () => {
    mockGetStatus
      .mockResolvedValueOnce(makeStatus('RUNNING', { scannedAlbums: 100 }))
      .mockResolvedValueOnce(makeStatus('COMPLETED'))

    render(<ScanProgress />)
    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    await act(async () => {
      await Promise.resolve()
    })

    // At this point polling should have stopped
    await act(async () => {
      vi.advanceTimersByTime(4000)
    })
    await act(async () => {
      await Promise.resolve()
    })

    // Only called twice — once for RUNNING, once for COMPLETED
    expect(mockGetStatus).toHaveBeenCalledTimes(2)
  })

  it('stops polling when status transitions to FAILED', async () => {
    mockGetStatus
      .mockResolvedValueOnce(makeStatus('RUNNING', { scannedAlbums: 50 }))
      .mockResolvedValueOnce(makeStatus('FAILED', { errorMessage: 'Permission denied' }))

    render(<ScanProgress />)
    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      vi.advanceTimersByTime(4000)
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(mockGetStatus).toHaveBeenCalledTimes(2)
  })

  it('updates progress count on each poll', async () => {
    mockGetStatus
      .mockResolvedValueOnce(makeStatus('RUNNING', { scannedAlbums: 10, totalAlbums: 100 }))
      .mockResolvedValueOnce(makeStatus('RUNNING', { scannedAlbums: 50, totalAlbums: 100 }))

    render(<ScanProgress />)
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByRole('status')).toHaveTextContent('Scanning: 10 / 100 albums')

    // Advance the interval and flush the promise
    await act(async () => {
      vi.advanceTimersByTime(2000)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByRole('status')).toHaveTextContent('Scanning: 50 / 100 albums')
  })
})
