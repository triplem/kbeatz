import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SyncPanel } from './sync-panel'
import { AlbumsService } from '../../api/generated'
import type { Album } from '../../api/generated'

vi.mock('../../api/generated', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/generated')>()
  return {
    ...actual,
    AlbumsService: {
      ...actual.AlbumsService,
      syncAlbumFromDiscogs: vi.fn(),
    },
  }
})

const mockSyncAlbum = vi.mocked(AlbumsService.syncAlbumFromDiscogs)

function buildAlbum(overrides: Partial<Album> = {}): Album {
  return {
    id: 'test-album-id',
    albumArtist: 'Miles Davis',
    album: 'Kind of Blue',
    directoryPath: '/music/jazz/miles-davis',
    hasCoverArt: false,
    discogsId: '12345',
    ...overrides,
  }
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

function renderSyncPanel(props: { album: Album; onSyncComplete: (a: Album) => void; hasLocalEdits?: boolean }) {
  const queryClient = makeQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <SyncPanel {...props} />
    </QueryClientProvider>,
  )
}

describe('SyncPanel', () => {
  const onSyncComplete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ---- visibility ----

  it('should not render when album has no discogsId', () => {
    const album = buildAlbum({ discogsId: undefined })
    const { container } = renderSyncPanel({ album, onSyncComplete })
    expect(container.firstChild).toBeNull()
  })

  it('should render sync panel when album has a discogsId', () => {
    const album = buildAlbum()
    renderSyncPanel({ album, onSyncComplete })
    expect(screen.getByTestId('sync-button')).toBeInTheDocument()
    expect(screen.getByTestId('discogs-id')).toHaveTextContent('12345')
    expect(screen.getByTestId('discogs-id')).toBeVisible()
  })

  // ---- default checkbox state ----

  it('should show "Also update cover art" checkbox unchecked by default', () => {
    const album = buildAlbum()
    renderSyncPanel({ album, onSyncComplete })
    const checkbox = screen.getByTestId('download-images-checkbox')
    expect(checkbox).not.toBeChecked()
  })

  // ---- loading state ----

  it('should show loading indicator and disable button during sync', async () => {
    const album = buildAlbum()
    let resolve: (v: Album) => void = () => {}
    mockSyncAlbum.mockReturnValue(new Promise((r) => { resolve = r }) as ReturnType<typeof mockSyncAlbum>)

    renderSyncPanel({ album, onSyncComplete })
    const button = screen.getByTestId('sync-button')

    await userEvent.click(button)

    expect(screen.getByTestId('sync-loading')).toBeInTheDocument()
    expect(button).toBeDisabled()

    // Clean up — resolve to avoid pending promise warning
    resolve(buildAlbum())
    await waitFor(() => expect(screen.queryByTestId('sync-loading')).not.toBeInTheDocument())
  })

  // ---- success state ----

  it('should show success message after sync completes', async () => {
    const album = buildAlbum()
    const updatedAlbum = buildAlbum({ album: 'Kind of Blue (updated)' })
    mockSyncAlbum.mockResolvedValue(updatedAlbum)

    renderSyncPanel({ album, onSyncComplete })
    await userEvent.click(screen.getByTestId('sync-button'))

    await waitFor(() => expect(screen.getByTestId('sync-success')).toBeInTheDocument())
    expect(onSyncComplete).toHaveBeenCalledWith(updatedAlbum)
  })

  it('should display fieldsWritten count when fields changed', async () => {
    const album = buildAlbum({ genre: undefined, date: undefined })
    // Two fields changed: genre and date were added
    const updatedAlbum = buildAlbum({ genre: 'Jazz', date: '1959' })
    mockSyncAlbum.mockResolvedValue(updatedAlbum)

    renderSyncPanel({ album, onSyncComplete })
    await userEvent.click(screen.getByTestId('sync-button'))

    await waitFor(() => expect(screen.getByTestId('sync-success')).toBeInTheDocument())
    expect(screen.getByTestId('sync-success')).toHaveTextContent('2 fields updated')
  })

  it('should display singular "field" when exactly 1 field changed', async () => {
    const album = buildAlbum({ genre: undefined })
    const updatedAlbum = buildAlbum({ genre: 'Jazz' })
    mockSyncAlbum.mockResolvedValue(updatedAlbum)

    renderSyncPanel({ album, onSyncComplete })
    await userEvent.click(screen.getByTestId('sync-button'))

    await waitFor(() => expect(screen.getByTestId('sync-success')).toBeInTheDocument())
    expect(screen.getByTestId('sync-success')).toHaveTextContent('1 field updated')
    expect(screen.getByTestId('sync-success')).not.toHaveTextContent('1 fields')
  })

  it('should display 0 fields updated when nothing changed', async () => {
    const album = buildAlbum()
    // Same album returned — no changes
    const updatedAlbum = buildAlbum()
    mockSyncAlbum.mockResolvedValue(updatedAlbum)

    renderSyncPanel({ album, onSyncComplete })
    await userEvent.click(screen.getByTestId('sync-button'))

    await waitFor(() => expect(screen.getByTestId('sync-success')).toBeInTheDocument())
    expect(screen.getByTestId('sync-success')).toHaveTextContent('0 fields updated')
  })

  // ---- error state ----

  it('should show error message on sync failure', async () => {
    const album = buildAlbum()
    mockSyncAlbum.mockRejectedValue({
      body: { code: 'SYNC_FAILED', message: 'Discogs API unavailable. Please try again later.' },
    })

    renderSyncPanel({ album, onSyncComplete })
    await userEvent.click(screen.getByTestId('sync-button'))

    await waitFor(() => expect(screen.getByTestId('sync-error')).toBeInTheDocument())
    expect(screen.getByTestId('sync-error')).toHaveTextContent('Discogs API unavailable')
  })

  it('should show 404 error message when album not found in Discogs', async () => {
    const album = buildAlbum()
    mockSyncAlbum.mockRejectedValue({
      body: { code: 'RESOURCE_NOT_FOUND', message: 'Discogs release 12345 not found' },
    })

    renderSyncPanel({ album, onSyncComplete })
    await userEvent.click(screen.getByTestId('sync-button'))

    await waitFor(() => expect(screen.getByTestId('sync-error')).toBeInTheDocument())
    expect(screen.getByTestId('sync-error')).toHaveTextContent('not found')
  })

  // ---- quota exhausted state ----

  it('should show quota exhausted message with reset time', async () => {
    const album = buildAlbum()
    mockSyncAlbum.mockRejectedValue({
      body: {
        code: 'IMAGE_QUOTA_EXHAUSTED',
        message: 'Daily image quota exhausted',
        details: ['resetAt=2026-06-08T00:00:00Z'],
      },
    })

    const user = userEvent.setup()
    renderSyncPanel({ album, onSyncComplete })

    // Check the cover art checkbox so the IMAGE_QUOTA_EXHAUSTED path is hit
    await user.click(screen.getByTestId('download-images-checkbox'))
    await user.click(screen.getByTestId('sync-button'))

    await waitFor(() => expect(screen.getByTestId('sync-quota-exhausted')).toBeInTheDocument())
    expect(screen.getByTestId('sync-quota-exhausted')).toHaveTextContent('2026-06-08T00:00:00Z')
  })

  // ---- downloadImages checkbox ----

  it('should send downloadImages=true when checkbox is checked', async () => {
    const album = buildAlbum()
    const updatedAlbum = buildAlbum()
    mockSyncAlbum.mockResolvedValue(updatedAlbum)

    renderSyncPanel({ album, onSyncComplete })
    await userEvent.click(screen.getByTestId('download-images-checkbox'))
    await userEvent.click(screen.getByTestId('sync-button'))

    await waitFor(() => expect(mockSyncAlbum).toHaveBeenCalledWith({
      albumId: 'test-album-id',
      requestBody: { downloadImages: true },
    }))
  })

  it('should send downloadImages=false when checkbox is not checked', async () => {
    const album = buildAlbum()
    mockSyncAlbum.mockResolvedValue(buildAlbum())

    renderSyncPanel({ album, onSyncComplete })
    await userEvent.click(screen.getByTestId('sync-button'))

    await waitFor(() => expect(mockSyncAlbum).toHaveBeenCalledWith({
      albumId: 'test-album-id',
      requestBody: { downloadImages: false },
    }))
  })

  // ---- WCAG AA accessibility (#389) ----

  it('sync button is keyboard-accessible (findable by role and label)', () => {
    renderSyncPanel({ album: buildAlbum(), onSyncComplete })
    expect(screen.getByRole('button', { name: 'Sync from Discogs' })).toBeInTheDocument()
  })

  it('download cover art checkbox is keyboard-accessible', () => {
    renderSyncPanel({ album: buildAlbum(), onSyncComplete })
    expect(screen.getByRole('checkbox', { name: 'Download cover art' })).toBeInTheDocument()
  })

  it('success message has role=status and aria-live=polite for screen reader announcement', async () => {
    const album = buildAlbum()
    mockSyncAlbum.mockResolvedValue(buildAlbum())

    renderSyncPanel({ album, onSyncComplete })
    await userEvent.click(screen.getByTestId('sync-button'))

    await waitFor(() => {
      const statusEl = screen.getByTestId('sync-success')
      expect(statusEl).toHaveAttribute('role', 'status')
      expect(statusEl).toHaveAttribute('aria-live', 'polite')
    })
  })

  it('error message has role=alert for immediate screen reader announcement', async () => {
    mockSyncAlbum.mockRejectedValue({ body: { message: 'Server error' } })

    renderSyncPanel({ album: buildAlbum(), onSyncComplete })
    await userEvent.click(screen.getByTestId('sync-button'))

    await waitFor(() => {
      const alertEl = screen.getByTestId('sync-error')
      expect(alertEl).toHaveAttribute('role', 'alert')
    })
  })

  it('sync button has aria-disabled=true while syncing', async () => {
    // Mock a slow sync so we can check the button state during the request
    mockSyncAlbum.mockImplementation(
      () =>
        new Promise((r) => {
          // Resolve after a short delay to allow state transition
          setTimeout(() => { r(buildAlbum()) }, 100)
        }) as ReturnType<typeof AlbumsService.syncAlbumFromDiscogs>,
    )

    renderSyncPanel({ album: buildAlbum(), onSyncComplete })
    await userEvent.click(screen.getByTestId('sync-button'))

    // Button should be disabled immediately after click
    const button = screen.getByTestId('sync-button')
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toBeDisabled()

    // Wait for mock to resolve and loading to clear
    await waitFor(() => {
      expect(screen.queryByTestId('sync-loading')).not.toBeInTheDocument()
    })
  })

  // ---- Overwrite warning (#392) ----

  it('sync proceeds without dialog when hasLocalEdits is false', async () => {
    const album = buildAlbum()
    mockSyncAlbum.mockResolvedValue(buildAlbum())

    renderSyncPanel({ album, onSyncComplete, hasLocalEdits: false })
    await userEvent.click(screen.getByTestId('sync-button'))

    // No dialog should appear
    expect(screen.queryByTestId('sync-overwrite-dialog')).not.toBeInTheDocument()
    // Sync should have been called directly
    await waitFor(() => expect(mockSyncAlbum).toHaveBeenCalled())
  })

  it('shows overwrite warning dialog when hasLocalEdits is true', async () => {
    renderSyncPanel({ album: buildAlbum(), onSyncComplete, hasLocalEdits: true })
    await userEvent.click(screen.getByTestId('sync-button'))

    // Dialog should appear
    expect(screen.getByTestId('sync-overwrite-dialog')).toBeInTheDocument()
    expect(screen.getByTestId('sync-overwrite-dialog')).toHaveAttribute('role', 'dialog')
    // Sync should NOT have been called yet
    expect(mockSyncAlbum).not.toHaveBeenCalled()
  })

  it('aborts sync when user cancels the overwrite warning', async () => {
    renderSyncPanel({ album: buildAlbum(), onSyncComplete, hasLocalEdits: true })
    await userEvent.click(screen.getByTestId('sync-button'))

    expect(screen.getByTestId('sync-overwrite-dialog')).toBeInTheDocument()
    await userEvent.click(screen.getByTestId('sync-overwrite-cancel'))

    // Dialog should be gone and sync should not have been called
    expect(screen.queryByTestId('sync-overwrite-dialog')).not.toBeInTheDocument()
    expect(mockSyncAlbum).not.toHaveBeenCalled()
  })

  it('proceeds with sync when user confirms the overwrite warning', async () => {
    mockSyncAlbum.mockResolvedValue(buildAlbum())
    renderSyncPanel({ album: buildAlbum(), onSyncComplete, hasLocalEdits: true })
    await userEvent.click(screen.getByTestId('sync-button'))

    expect(screen.getByTestId('sync-overwrite-dialog')).toBeInTheDocument()
    await userEvent.click(screen.getByTestId('sync-overwrite-confirm'))

    // Dialog gone and sync called
    expect(screen.queryByTestId('sync-overwrite-dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(mockSyncAlbum).toHaveBeenCalled())
  })
})
