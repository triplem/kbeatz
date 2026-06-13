import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ScanButton } from './scan-button'
import type { ScanStatus } from '../../api/generated'

vi.mock('../../api/generated', () => ({
  LibraryService: {
    triggerLibraryScan: vi.fn(),
    getLibraryScanStatus: vi.fn(),
  },
}))

import { LibraryService } from '../../api/generated'
const mockTrigger = vi.mocked(LibraryService.triggerLibraryScan)
const mockGetStatus = vi.mocked(LibraryService.getLibraryScanStatus)

function makeStatus(
  state: ScanStatus['state'],
  overrides: Partial<ScanStatus> = {},
): ScanStatus {
  return { state, ...overrides }
}

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('ScanButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the scan button', async () => {
    mockGetStatus.mockResolvedValue(makeStatus('IDLE'))
    mockTrigger.mockResolvedValue(makeStatus('COMPLETED'))
    renderWithQuery(<ScanButton />)

    await waitFor(() => {
      expect(mockGetStatus).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('button is enabled when status is IDLE', async () => {
    mockGetStatus.mockResolvedValue(makeStatus('IDLE'))
    mockTrigger.mockResolvedValue(makeStatus('COMPLETED'))
    renderWithQuery(<ScanButton />)

    await waitFor(() => {
      expect(mockGetStatus).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByRole('button')).not.toBeDisabled()
  })

  it('button is disabled when a scan is RUNNING', async () => {
    mockGetStatus.mockResolvedValue(makeStatus('RUNNING', { scannedAlbums: 0, totalAlbums: 100 }))
    mockTrigger.mockResolvedValue(makeStatus('COMPLETED'))
    renderWithQuery(<ScanButton />)

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeDisabled()
    })
  })

  it('calls triggerLibraryScan when the button is clicked', async () => {
    mockGetStatus.mockResolvedValue(makeStatus('IDLE'))
    mockTrigger.mockResolvedValue(makeStatus('COMPLETED'))
    renderWithQuery(<ScanButton />)

    await waitFor(() => {
      expect(screen.getByRole('button')).not.toBeDisabled()
    })

    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(mockTrigger).toHaveBeenCalledTimes(1)
    })
  })

  it('does not show error message when mutation succeeds', async () => {
    mockGetStatus.mockResolvedValue(makeStatus('IDLE'))
    mockTrigger.mockResolvedValue(makeStatus('COMPLETED'))
    renderWithQuery(<ScanButton />)

    await waitFor(() => {
      expect(mockGetStatus).toHaveBeenCalledTimes(1)
    })

    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows error message when mutation fails', async () => {
    mockGetStatus.mockResolvedValue(makeStatus('IDLE'))
    mockTrigger.mockRejectedValue(new Error('Network error'))
    renderWithQuery(<ScanButton />)

    await waitFor(() => {
      expect(screen.getByRole('button')).not.toBeDisabled()
    })

    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })
})
