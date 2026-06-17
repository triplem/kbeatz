import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SyncPanel } from './sync-panel'
import { AlbumsService } from '../../api/generated'
import { CancelError } from '../../api/generated/core/CancelablePromise'
import type { Album, AlbumDetail, SyncPreviewResponse } from '../../api/generated'

vi.mock('../../api/generated', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/generated')>()
  return {
    ...actual,
    AlbumsService: {
      ...actual.AlbumsService,
      syncAlbumFromDiscogs: vi.fn(),
      previewSyncFromDiscogs: vi.fn(),
    },
  }
})

const mockSyncAlbum = vi.mocked(AlbumsService.syncAlbumFromDiscogs)
const mockPreviewSync = vi.mocked(AlbumsService.previewSyncFromDiscogs)

function buildAlbum(overrides: Partial<Album> = {}): Album {
  return {
    id: 'test-album-id',
    albumArtist: 'Miles Davis',
    album: 'Kind of Blue',
    albumPath: 'Jazz/Miles Davis/Kind of Blue',
    hasCoverArt: false,
    discogsId: '12345',
    ...overrides,
  }
}

function buildAlbumDetail(overrides: Partial<AlbumDetail> = {}): AlbumDetail {
  return {
    id: 'test-album-id',
    albumArtist: 'Miles Davis',
    album: 'Kind of Blue',
    albumPath: 'Jazz/Miles Davis/Kind of Blue',
    hasCoverArt: false,
    discogsId: '12345',
    tracks: [],
    ...overrides,
  }
}

function buildPreviewResponse(overrides: Partial<SyncPreviewResponse> = {}): SyncPreviewResponse {
  return {
    albumId: 'test-album-id',
    proposedChanges: [],
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

function renderSyncPanel(props: { album: AlbumDetail; onSyncComplete: (a: Album) => void; hasLocalEdits?: boolean }) {
  const queryClient = makeQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <SyncPanel {...props} />
    </QueryClientProvider>,
  )
}

/**
 * Helper: click the sync button, wait for the preview dialog to appear,
 * then click Confirm sync. Requires mockPreviewSync to already be set up.
 */
async function clickSyncAndConfirmPreview() {
  const user = userEvent.setup()
  await user.click(screen.getByTestId('sync-button'))
  await waitFor(() => expect(screen.getByTestId('sync-preview-dialog')).toBeInTheDocument())
  await user.click(screen.getByTestId('sync-preview-confirm'))
}

describe('SyncPanel', () => {
  const onSyncComplete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    // Default: preview returns no changes
    mockPreviewSync.mockResolvedValue(buildPreviewResponse())
  })

  // ---- visibility ----

  it('should not render when album has no discogsId', () => {
    const album = buildAlbumDetail({ discogsId: undefined })
    const { container } = renderSyncPanel({ album, onSyncComplete })
    expect(container.firstChild).toBeNull()
  })

  it('should render sync panel when album has a discogsId', () => {
    const album = buildAlbumDetail()
    renderSyncPanel({ album, onSyncComplete })
    expect(screen.getByTestId('sync-button')).toBeInTheDocument()
    expect(screen.getByTestId('discogs-id')).toHaveTextContent('12345')
    expect(screen.getByTestId('discogs-id')).toBeVisible()
  })

  // ---- default checkbox state ----

  it('should show "Also update cover art" checkbox unchecked by default', () => {
    const album = buildAlbumDetail()
    renderSyncPanel({ album, onSyncComplete })
    const checkbox = screen.getByTestId('download-images-checkbox')
    expect(checkbox).not.toBeChecked()
  })

  // ---- preview flow ----

  it('should open preview dialog when sync button is clicked', async () => {
    renderSyncPanel({ album: buildAlbumDetail(), onSyncComplete })
    await userEvent.click(screen.getByTestId('sync-button'))

    await waitFor(() => expect(screen.getByTestId('sync-preview-dialog')).toBeInTheDocument())
    expect(mockPreviewSync).toHaveBeenCalledWith({ albumId: 'test-album-id' })
    // Sync must NOT have been called yet
    expect(mockSyncAlbum).not.toHaveBeenCalled()
  })

  it('should close preview dialog and return to idle when Cancel is clicked', async () => {
    renderSyncPanel({ album: buildAlbumDetail(), onSyncComplete })
    await userEvent.click(screen.getByTestId('sync-button'))

    await waitFor(() => expect(screen.getByTestId('sync-preview-dialog')).toBeInTheDocument())
    await userEvent.click(screen.getByTestId('sync-preview-cancel'))

    expect(screen.queryByTestId('sync-preview-dialog')).not.toBeInTheDocument()
    expect(mockSyncAlbum).not.toHaveBeenCalled()
  })

  it('should show proposed changes table in preview dialog', async () => {
    mockPreviewSync.mockResolvedValue(buildPreviewResponse({
      proposedChanges: [
        { field: 'GENRE', currentValue: 'Jazz', proposedValue: 'Modal Jazz' },
      ],
    }))

    renderSyncPanel({ album: buildAlbumDetail(), onSyncComplete })
    await userEvent.click(screen.getByTestId('sync-button'))

    await waitFor(() => expect(screen.getByTestId('sync-preview-table')).toBeInTheDocument())
    expect(screen.getByTestId('sync-preview-row-GENRE')).toBeInTheDocument()
  })

  it('should show no-changes message in preview dialog when no changes', async () => {
    mockPreviewSync.mockResolvedValue(buildPreviewResponse({ proposedChanges: [] }))

    renderSyncPanel({ album: buildAlbumDetail(), onSyncComplete })
    await userEvent.click(screen.getByTestId('sync-button'))

    await waitFor(() => expect(screen.getByTestId('sync-preview-no-changes')).toBeInTheDocument())
  })

  it('should show loading state in preview dialog while preview fetch is in flight', async () => {
    let resolve: (v: SyncPreviewResponse) => void = () => {}
    mockPreviewSync.mockReturnValue(
      new Promise((r) => { resolve = r }) as ReturnType<typeof mockPreviewSync>,
    )

    renderSyncPanel({ album: buildAlbumDetail(), onSyncComplete })
    await userEvent.click(screen.getByTestId('sync-button'))

    await waitFor(() => expect(screen.getByTestId('sync-preview-dialog')).toBeInTheDocument())
    expect(screen.getByTestId('sync-preview-loading')).toBeInTheDocument()
    // Sync button should also be disabled while preview is loading
    expect(screen.getByTestId('sync-button')).toBeDisabled()

    // Clean up
    resolve(buildPreviewResponse())
    await waitFor(() => expect(screen.queryByTestId('sync-preview-loading')).not.toBeInTheDocument())
  })

  it('should show error in preview dialog when preview fetch fails', async () => {
    mockPreviewSync.mockRejectedValue({ body: { message: 'Discogs unavailable' } })

    renderSyncPanel({ album: buildAlbumDetail(), onSyncComplete })
    await userEvent.click(screen.getByTestId('sync-button'))

    await waitFor(() => expect(screen.getByTestId('sync-preview-error')).toBeInTheDocument())
    expect(screen.getByTestId('sync-preview-error')).toHaveTextContent('Discogs unavailable')
    expect(mockSyncAlbum).not.toHaveBeenCalled()
  })

  // ---- loading state (after preview confirmed) ----

  it('should show loading indicator and disable button during sync', async () => {
    const album = buildAlbumDetail()
    let resolve: (v: Album) => void = () => {}
    mockSyncAlbum.mockReturnValue(new Promise((r) => { resolve = r }) as ReturnType<typeof mockSyncAlbum>)

    renderSyncPanel({ album, onSyncComplete })
    await clickSyncAndConfirmPreview()

    expect(screen.getByTestId('sync-loading')).toBeInTheDocument()
    const button = screen.getByTestId('sync-button')
    expect(button).toBeDisabled()

    // Clean up - resolve to avoid pending promise warning
    resolve(buildAlbum())
    await waitFor(() => expect(screen.queryByTestId('sync-loading')).not.toBeInTheDocument())
  })

  // ---- success state ----

  it('should show success message after sync completes', async () => {
    const album = buildAlbumDetail()
    const updatedAlbum = buildAlbum({ album: 'Kind of Blue (updated)' })
    mockSyncAlbum.mockResolvedValue(updatedAlbum)

    renderSyncPanel({ album, onSyncComplete })
    await clickSyncAndConfirmPreview()

    await waitFor(() => expect(screen.getByTestId('sync-success')).toBeInTheDocument())
    expect(onSyncComplete).toHaveBeenCalledWith(updatedAlbum)
  })

  it('should display fieldsWritten count when fields changed', async () => {
    const album = buildAlbumDetail({ genre: undefined, date: undefined })
    // Two fields changed: genre and date were added
    const updatedAlbum = buildAlbum({ genre: 'Jazz', date: '1959' })
    mockSyncAlbum.mockResolvedValue(updatedAlbum)

    renderSyncPanel({ album, onSyncComplete })
    await clickSyncAndConfirmPreview()

    await waitFor(() => expect(screen.getByTestId('sync-success')).toBeInTheDocument())
    expect(screen.getByTestId('sync-success')).toHaveTextContent('2 fields updated')
  })

  it('should display singular "field" when exactly 1 field changed', async () => {
    const album = buildAlbumDetail({ genre: undefined })
    const updatedAlbum = buildAlbum({ genre: 'Jazz' })
    mockSyncAlbum.mockResolvedValue(updatedAlbum)

    renderSyncPanel({ album, onSyncComplete })
    await clickSyncAndConfirmPreview()

    await waitFor(() => expect(screen.getByTestId('sync-success')).toBeInTheDocument())
    expect(screen.getByTestId('sync-success')).toHaveTextContent('1 field updated')
    expect(screen.getByTestId('sync-success')).not.toHaveTextContent('1 fields')
  })

  it('should display 0 fields updated when nothing changed', async () => {
    const album = buildAlbumDetail()
    // Same album returned - no changes
    const updatedAlbum = buildAlbum()
    mockSyncAlbum.mockResolvedValue(updatedAlbum)

    renderSyncPanel({ album, onSyncComplete })
    await clickSyncAndConfirmPreview()

    await waitFor(() => expect(screen.getByTestId('sync-success')).toBeInTheDocument())
    expect(screen.getByTestId('sync-success')).toHaveTextContent('0 fields updated')
  })

  it('should dismiss the success snackbar when its close button is clicked', async () => {
    const album = buildAlbumDetail()
    mockSyncAlbum.mockResolvedValue(buildAlbum())

    const user = userEvent.setup()
    renderSyncPanel({ album, onSyncComplete })
    await user.click(screen.getByTestId('sync-button'))
    await waitFor(() => expect(screen.getByTestId('sync-preview-dialog')).toBeInTheDocument())
    await user.click(screen.getByTestId('sync-preview-confirm'))

    await waitFor(() => expect(screen.getByTestId('sync-success')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByTestId('sync-success')).not.toBeInTheDocument())
  })

  // ---- error state ----

  it('should show error message on sync failure', async () => {
    const album = buildAlbumDetail()
    mockSyncAlbum.mockRejectedValue({
      body: { code: 'SYNC_FAILED', message: 'Discogs API unavailable. Please try again later.' },
    })

    renderSyncPanel({ album, onSyncComplete })
    await clickSyncAndConfirmPreview()

    await waitFor(() => expect(screen.getByTestId('sync-error')).toBeInTheDocument())
    expect(screen.getByTestId('sync-error')).toHaveTextContent('Discogs API unavailable')
  })

  it('should show a timeout error message when the request is cancelled', async () => {
    const album = buildAlbumDetail()
    // A CancelError simulates the client-side 30s timeout cancelling the request.
    mockSyncAlbum.mockRejectedValue(
      new CancelError('Request aborted') as unknown as Album,
    )

    renderSyncPanel({ album, onSyncComplete })
    await clickSyncAndConfirmPreview()

    await waitFor(() => expect(screen.getByTestId('sync-error')).toBeInTheDocument())
    expect(screen.getByTestId('sync-error')).toHaveTextContent('Sync timed out')
  })

  it('should show 404 error message when album not found in Discogs', async () => {
    const album = buildAlbumDetail()
    mockSyncAlbum.mockRejectedValue({
      body: { code: 'RESOURCE_NOT_FOUND', message: 'Discogs release 12345 not found' },
    })

    renderSyncPanel({ album, onSyncComplete })
    await clickSyncAndConfirmPreview()

    await waitFor(() => expect(screen.getByTestId('sync-error')).toBeInTheDocument())
    expect(screen.getByTestId('sync-error')).toHaveTextContent('not found')
  })

  // ---- quota exhausted state ----

  it('should show quota exhausted message with reset time', async () => {
    const album = buildAlbumDetail()
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
    await waitFor(() => expect(screen.getByTestId('sync-preview-dialog')).toBeInTheDocument())
    await user.click(screen.getByTestId('sync-preview-confirm'))

    await waitFor(() => expect(screen.getByTestId('sync-quota-exhausted')).toBeInTheDocument())
    expect(screen.getByTestId('sync-quota-exhausted')).toHaveTextContent('2026-06-08T00:00:00Z')
  })

  // ---- downloadImages checkbox ----

  it('should send downloadImages=true when checkbox is checked', async () => {
    const album = buildAlbumDetail()
    const updatedAlbum = buildAlbum()
    mockSyncAlbum.mockResolvedValue(updatedAlbum)

    const user = userEvent.setup()
    renderSyncPanel({ album, onSyncComplete })
    await user.click(screen.getByTestId('download-images-checkbox'))
    await user.click(screen.getByTestId('sync-button'))
    await waitFor(() => expect(screen.getByTestId('sync-preview-dialog')).toBeInTheDocument())
    await user.click(screen.getByTestId('sync-preview-confirm'))

    await waitFor(() => expect(mockSyncAlbum).toHaveBeenCalledWith({
      albumId: 'test-album-id',
      requestBody: { downloadImages: true },
    }))
  })

  it('should send downloadImages=false when checkbox is not checked', async () => {
    const album = buildAlbumDetail()
    mockSyncAlbum.mockResolvedValue(buildAlbum())

    renderSyncPanel({ album, onSyncComplete })
    await clickSyncAndConfirmPreview()

    await waitFor(() => expect(mockSyncAlbum).toHaveBeenCalledWith({
      albumId: 'test-album-id',
      requestBody: { downloadImages: false },
    }))
  })

  // ---- WCAG AA accessibility (#389) ----

  it('sync button is keyboard-accessible (findable by role and label)', () => {
    renderSyncPanel({ album: buildAlbumDetail(), onSyncComplete })
    expect(screen.getByRole('button', { name: 'Sync from Discogs' })).toBeInTheDocument()
  })

  it('download cover art checkbox is keyboard-accessible', () => {
    renderSyncPanel({ album: buildAlbumDetail(), onSyncComplete })
    expect(screen.getByRole('checkbox', { name: 'Download cover art' })).toBeInTheDocument()
  })

  it('success message has role=status and aria-live=polite for screen reader announcement', async () => {
    const album = buildAlbumDetail()
    mockSyncAlbum.mockResolvedValue(buildAlbum())

    renderSyncPanel({ album, onSyncComplete })
    await clickSyncAndConfirmPreview()

    await waitFor(() => {
      const statusEl = screen.getByTestId('sync-success')
      expect(statusEl).toHaveAttribute('role', 'status')
      expect(statusEl).toHaveAttribute('aria-live', 'polite')
    })
  })

  it('error message has role=alert for immediate screen reader announcement', async () => {
    mockSyncAlbum.mockRejectedValue({ body: { message: 'Server error' } })

    renderSyncPanel({ album: buildAlbumDetail(), onSyncComplete })
    await clickSyncAndConfirmPreview()

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

    renderSyncPanel({ album: buildAlbumDetail(), onSyncComplete })
    await clickSyncAndConfirmPreview()

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

  it('sync proceeds to preview without overwrite dialog when hasLocalEdits is false', async () => {
    renderSyncPanel({ album: buildAlbumDetail(), onSyncComplete, hasLocalEdits: false })
    await userEvent.click(screen.getByTestId('sync-button'))

    // No overwrite dialog
    expect(screen.queryByTestId('sync-overwrite-dialog')).not.toBeInTheDocument()
    // Preview dialog appears
    await waitFor(() => expect(screen.getByTestId('sync-preview-dialog')).toBeInTheDocument())
    expect(mockSyncAlbum).not.toHaveBeenCalled()
  })

  it('shows overwrite warning dialog when hasLocalEdits is true', async () => {
    renderSyncPanel({ album: buildAlbumDetail(), onSyncComplete, hasLocalEdits: true })
    await userEvent.click(screen.getByTestId('sync-button'))

    // Dialog should appear
    expect(screen.getByTestId('sync-overwrite-dialog')).toBeInTheDocument()
    expect(screen.getByTestId('sync-overwrite-dialog')).toHaveAttribute('role', 'dialog')
    // Sync should NOT have been called yet
    expect(mockSyncAlbum).not.toHaveBeenCalled()
    expect(mockPreviewSync).not.toHaveBeenCalled()
  })

  it('aborts sync when user cancels the overwrite warning', async () => {
    renderSyncPanel({ album: buildAlbumDetail(), onSyncComplete, hasLocalEdits: true })
    await userEvent.click(screen.getByTestId('sync-button'))

    expect(screen.getByTestId('sync-overwrite-dialog')).toBeInTheDocument()
    await userEvent.click(screen.getByTestId('sync-overwrite-dialog-cancel'))

    // Dialog should be gone and neither preview nor sync should have been called
    expect(screen.queryByTestId('sync-overwrite-dialog')).not.toBeInTheDocument()
    expect(mockPreviewSync).not.toHaveBeenCalled()
    expect(mockSyncAlbum).not.toHaveBeenCalled()
  })

  it('proceeds to preview when user confirms the overwrite warning', async () => {
    renderSyncPanel({ album: buildAlbumDetail(), onSyncComplete, hasLocalEdits: true })
    await userEvent.click(screen.getByTestId('sync-button'))

    expect(screen.getByTestId('sync-overwrite-dialog')).toBeInTheDocument()
    await userEvent.click(screen.getByTestId('sync-overwrite-dialog-confirm'))

    // Overwrite dialog gone, preview dialog appears
    expect(screen.queryByTestId('sync-overwrite-dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('sync-preview-dialog')).toBeInTheDocument())
    expect(mockPreviewSync).toHaveBeenCalled()
    expect(mockSyncAlbum).not.toHaveBeenCalled()
  })

  it('executes sync when preview is confirmed after overwrite warning', async () => {
    mockSyncAlbum.mockResolvedValue(buildAlbum())
    renderSyncPanel({ album: buildAlbumDetail(), onSyncComplete, hasLocalEdits: true })

    const user = userEvent.setup()
    await user.click(screen.getByTestId('sync-button'))
    // Confirm overwrite
    await user.click(screen.getByTestId('sync-overwrite-dialog-confirm'))
    // Wait for preview dialog
    await waitFor(() => expect(screen.getByTestId('sync-preview-dialog')).toBeInTheDocument())
    // Confirm preview
    await user.click(screen.getByTestId('sync-preview-confirm'))

    await waitFor(() => expect(mockSyncAlbum).toHaveBeenCalled())
  })
})
