import { describe, it, vi, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppThemeProvider } from '../../theme'
import { ScanProgress } from './scan-progress'
import { ScanErrors } from './scan-errors'
import type { ScanStatus } from '../../api/generated'
import { expectNoA11yViolationsInBothThemes } from '../../test/a11y'

vi.mock('../../api/generated', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/generated')>()
  return {
    ...actual,
    LibraryService: { ...actual.LibraryService, getLibraryScanStatus: vi.fn() },
  }
})

import { LibraryService } from '../../api/generated'
const mockGetStatus = vi.mocked(LibraryService.getLibraryScanStatus)

function withQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <AppThemeProvider>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </AppThemeProvider>
  )
}

describe('Scan banner accessibility', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('ScanProgress RUNNING state has no WCAG 2.1 AA violations (both themes)', async () => {
    const status: ScanStatus = {
      state: 'RUNNING',
      scannedAlbums: 12,
      totalAlbums: 40,
      startedAt: '2026-06-17T10:00:00Z',
    }
    mockGetStatus.mockResolvedValue(status)
    await expectNoA11yViolationsInBothThemes(() => withQuery(<ScanProgress />))
  })

  it('ScanProgress FAILED state has no WCAG 2.1 AA violations (both themes)', async () => {
    mockGetStatus.mockResolvedValue({ state: 'FAILED', errorMessage: 'disk full' })
    await expectNoA11yViolationsInBothThemes(() => withQuery(<ScanProgress />))
  })

  it('ScanErrors has no WCAG 2.1 AA violations (both themes)', async () => {
    const errors = [
      { albumDir: '/music/broken-1', reason: 'Corrupt FLAC header', suggestion: 'Re-rip the disc' },
      { albumDir: '/music/broken-2', reason: 'Permission denied', suggestion: 'Check file permissions' },
    ]
    await expectNoA11yViolationsInBothThemes(() => (
      <AppThemeProvider>
        <ScanErrors errors={errors} totalErrors={2} />
      </AppThemeProvider>
    ))
  })
})
