import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AlbumDetail } from './album-detail'
import type { AlbumDetail as AlbumDetailModel, Track } from '../../api/generated'

// Mock the AlbumsService and SyncPanel
vi.mock('../../api/generated', () => ({
  AlbumsService: {
    getAlbum: vi.fn(),
    updateAlbumTags: vi.fn(),
    updateTrackTags: vi.fn(),
    bulkUpdateAlbumTags: vi.fn(),
    syncAlbumFromDiscogs: vi.fn(),
  },
}))

// Mock SyncPanel so album-detail tests do not depend on sync implementation
vi.mock('../sync/sync-panel', () => ({
  SyncPanel: ({ album, onSyncComplete }: { album: { discogsId?: string }; onSyncComplete: (a: unknown) => void }) => (
    <div data-testid="sync-panel" data-discogs-id={album.discogsId}>
      <button
        type="button"
        data-testid="mock-sync-complete"
        onClick={() => onSyncComplete({ id: 'album-id-1', albumArtist: 'Updated Artist', album: 'Updated Album', albumPath: '/music', hasCoverArt: false })}
      >
        Trigger sync complete
      </button>
    </div>
  ),
}))

import { AlbumsService } from '../../api/generated'

const mockAlbumsService = AlbumsService as unknown as {
  getAlbum: ReturnType<typeof vi.fn>
  updateAlbumTags: ReturnType<typeof vi.fn>
  updateTrackTags: ReturnType<typeof vi.fn>
  bulkUpdateAlbumTags: ReturnType<typeof vi.fn>
}

function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: 'track-id-1',
    albumId: 'album-id-1',
    title: 'So What',
    trackNumber: '1',
    artist: undefined,
    path: '01 So What.flac',
    filePath: '01 So What.flac',
    durationSeconds: 565,
    ...overrides,
  }
}

function makeAlbum(overrides: Partial<AlbumDetailModel> = {}): AlbumDetailModel {
  return {
    id: 'album-id-1',
    albumArtist: 'Miles Davis',
    album: 'Kind of Blue',
    date: '1959',
    genre: 'Jazz',
    label: 'Columbia',
    catalogNumber: 'CL 1355',
    composer: undefined,
    conductor: undefined,
    ensemble: undefined,
    discogsId: undefined,
    albumPath: 'Jazz/Miles Davis/Kind of Blue',
    hasCoverArt: false,
    tracks: [makeTrack()],
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

/**
 * Renders AlbumDetail using createMemoryRouter (a data router) so that
 * useBlocker works correctly. A fake list route '/' is included so that
 * navigate(-1) has history to navigate back to when needed.
 */
function renderDetail(albumId = 'album-id-1') {
  const queryClient = makeQueryClient()
  const router = createMemoryRouter(
    [
      { path: '/', element: <div data-testid="list-page">Album list</div> },
      { path: '/albums/:albumId', element: <AlbumDetail /> },
    ],
    {
      initialEntries: ['/', `/albums/${albumId}`],
      initialIndex: 1,
    },
  )
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

/**
 * Helper: click the Edit button to switch to edit mode.
 * Must be called after the album data has loaded.
 */
async function enterEditMode() {
  await waitFor(() => {
    expect(screen.getByTestId('edit-button')).toBeInTheDocument()
  })
  fireEvent.click(screen.getByTestId('edit-button'))
  await waitFor(() => {
    expect(screen.getByTestId('cancel-edit-button')).toBeInTheDocument()
  })
}

/**
 * Helper: open edit mode for a field, type a new value, press Enter to commit dirty,
 * then click the Save button, then click Confirm in the dialog.
 * Assumes edit mode is already active.
 */
async function editAlbumFieldAndConfirm(fieldTestId: string, inputTestId: string, newValue: string) {
  fireEvent.click(screen.getByTestId(fieldTestId))
  fireEvent.change(screen.getByTestId(inputTestId), { target: { value: newValue } })
  // Enter now commits as dirty (no dialog yet)
  fireEvent.keyDown(screen.getByTestId(inputTestId), { key: 'Enter' })

  // Wait for input to disappear (dirty commit exits edit mode)
  await waitFor(() => {
    expect(screen.queryByTestId(inputTestId)).not.toBeInTheDocument()
  })

  // Click the Save button to trigger the confirmation dialog
  fireEvent.click(screen.getByTestId('save-button'))

  await waitFor(() => {
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
  })

  fireEvent.click(screen.getByTestId('confirm-dialog-confirm'))
}

describe('AlbumDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ──────────────────────────────────────────────
  // Initial render (view mode by default)
  // ──────────────────────────────────────────────

  it('shows loading state initially', () => {
    mockAlbumsService.getAlbum.mockReturnValue(new Promise(() => undefined))
    renderDetail()
    expect(screen.getByText(/Loading album/)).toBeInTheDocument()
  })

  it('renders in view mode by default - no editable fields on load', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    // View mode: no editable fields, no save button
    expect(screen.queryByTestId('album-value-album')).not.toBeInTheDocument()
    expect(screen.queryByTestId('save-button')).not.toBeInTheDocument()
    expect(screen.queryByTestId('cancel-edit-button')).not.toBeInTheDocument()
  })

  it('renders album info in hero header in view mode', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('album-hero-header')).toBeInTheDocument()
    })
    expect(screen.getByTestId('hero-artist')).toHaveTextContent('Miles Davis')
    expect(screen.getByTestId('hero-album-title')).toHaveTextContent('Kind of Blue')
  })

  it('renders album fields in edit mode after clicking Edit', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('album-value-album')).toBeInTheDocument()
    })
    expect(screen.getByTestId('album-value-album')).toHaveTextContent('Kind of Blue')
    expect(screen.getByTestId('album-value-albumartist')).toHaveTextContent('Miles Davis')
    expect(screen.getByTestId('album-value-genre')).toHaveTextContent('Jazz')
  })

  it('renders cover image with loading="lazy" when hasCoverArt is true', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ hasCoverArt: true }))
    renderDetail()
    await waitFor(() => {
      // Hero cover art is shown in view mode
      expect(screen.getByTestId('hero-cover-art')).toBeInTheDocument()
    })
    const img = screen.getByTestId('hero-cover-art')
    expect(img).toHaveAttribute('loading', 'lazy')
    expect(img).toHaveAttribute('src', '/api/v1/albums/album-id-1/cover')
  })

  it('does not render hero cover art when hasCoverArt is false', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ hasCoverArt: false }))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('hero-cover-art')).not.toBeInTheDocument()
  })

  it('renders error state when fetch fails', async () => {
    mockAlbumsService.getAlbum.mockRejectedValue(new Error('Network error'))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Network error')
    })
  })

  it('renders tracks table with editable track fields in edit mode', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByText(/Tracks/)).toBeInTheDocument()
    })
    const trackId = 'track-id-1'
    expect(screen.getByTestId(`track-${trackId}-value-title`)).toHaveTextContent('So What')
  })

  it('renders all 9 album-level editable fields in edit mode', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(
      makeAlbum({
        composer: 'Miles Davis',
        conductor: 'Rattle',
        ensemble: 'LSO',
      }),
    )
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('album-value-album')).toBeInTheDocument()
    })
    const expectedFields = [
      'album-value-album',
      'album-value-albumartist',
      'album-value-date',
      'album-value-genre',
      'album-value-label',
      'album-value-catalognumber',
      'album-value-composer',
      'album-value-conductor',
      'album-value-ensemble',
    ]
    for (const testId of expectedFields) {
      expect(screen.getByTestId(testId)).toBeInTheDocument()
    }
  })

  // ──────────────────────────────────────────────
  // Discogs SyncPanel wiring
  // ──────────────────────────────────────────────

  it('renders SyncPanel in edit mode when album has a discogsId', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ discogsId: '12345' }))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('sync-panel')).toBeInTheDocument()
    })
    expect(screen.getByTestId('sync-panel')).toHaveAttribute('data-discogs-id', '12345')
  })

  it('does NOT render SyncPanel in edit mode when album has no discogsId', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ discogsId: undefined }))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('album-value-album')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('sync-panel')).not.toBeInTheDocument()
  })

  it('updates album tags when onSyncComplete is called (in edit mode)', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ discogsId: '12345' }))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('sync-panel')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('mock-sync-complete'))

    await waitFor(() => {
      // Hero header reflects the synced data
      expect(screen.getByTestId('hero-artist')).toHaveTextContent('Updated Artist')
      expect(screen.getByTestId('hero-album-title')).toHaveTextContent('Updated Album')
    })
  })

  // ──────────────────────────────────────────────
  // Click-to-edit: album level
  // ──────────────────────────────────────────────

  it('shows input when album-level field is clicked (in edit mode)', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('album-value-genre')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTestId('album-value-genre'))
    expect(screen.getByTestId('album-input-genre')).toHaveValue('Jazz')
  })

  it('calls bulkUpdateAlbumTags and updates album after confirmation', async () => {
    const updatedAlbum = makeAlbum({ genre: 'Progressive Rock' })
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    mockAlbumsService.bulkUpdateAlbumTags.mockResolvedValue(updatedAlbum)
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('album-value-genre')).toBeInTheDocument()
    })

    await editAlbumFieldAndConfirm('album-value-genre', 'album-input-genre', 'Progressive Rock')

    await waitFor(() => {
      expect(mockAlbumsService.bulkUpdateAlbumTags).toHaveBeenCalledWith({
        albumId: 'album-id-1',
        requestBody: {
          albumFields: [{ field: 'GENRE', value: 'Progressive Rock' }],
          trackFields: [],
        },
      })
    })
  })

  it('Escape cancels edit and makes no API call (no dialog shown)', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('album-value-genre')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('album-value-genre'))
    fireEvent.change(screen.getByTestId('album-input-genre'), { target: { value: 'Rock' } })
    fireEvent.keyDown(screen.getByTestId('album-input-genre'), { key: 'Escape' })

    expect(screen.queryByTestId('album-input-genre')).not.toBeInTheDocument()
    expect(screen.getByTestId('album-value-genre')).toHaveTextContent('Jazz')
    // Escape on the input cancels before the dialog - no dialog, no PATCH
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
    expect(mockAlbumsService.updateAlbumTags).not.toHaveBeenCalled()
  })

  it('retains dirty fields and shows error when batch save fails', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    mockAlbumsService.bulkUpdateAlbumTags.mockRejectedValue(new Error('Server error'))
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('album-value-genre')).toBeInTheDocument()
    })

    // Commit as dirty
    fireEvent.click(screen.getByTestId('album-value-genre'))
    fireEvent.change(screen.getByTestId('album-input-genre'), { target: { value: 'Rock' } })
    fireEvent.keyDown(screen.getByTestId('album-input-genre'), { key: 'Enter' })
    await waitFor(() => { expect(screen.queryByTestId('album-input-genre')).not.toBeInTheDocument() })

    // Open dialog and confirm
    fireEvent.click(screen.getByTestId('save-button'))
    await waitFor(() => { expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument() })
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'))

    // After failure: dialog closed, dirty fields retained for retry, error visible
    await waitFor(() => {
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
    })
    // Dirty count still visible (fields retained for retry)
    expect(screen.getByTestId('dirty-count')).toBeInTheDocument()
    // Error message displayed - must be the generic i18n message, not the raw exception string
    await waitFor(() => {
      const errorEl = screen.getByTestId('batch-save-error')
      expect(errorEl).toBeInTheDocument()
      // Generic message visible
      expect(errorEl.textContent).toContain('Something went wrong')
      // Raw exception message must NOT be exposed to the user
      expect(errorEl.textContent).not.toContain('Server error')
    })
  })

  it('shows structured server error code and message when ApiError body has code and message', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    // Construct an ApiError with a structured body matching ErrorResponse shape
    const { ApiError } = await import('../../api/generated/core/ApiError')
    const apiError = new ApiError(
      { method: 'PATCH', url: '/api/v1/albums/album-id-1/tags' },
      { url: '/api/v1/albums/album-id-1/tags', ok: false, status: 409, statusText: 'Conflict', body: { code: 'WRITE_LOCK_CONFLICT', message: 'Album is locked by another writer' } },
      'Conflict',
    )
    mockAlbumsService.bulkUpdateAlbumTags.mockRejectedValue(apiError)
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('album-value-genre')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('album-value-genre'))
    fireEvent.change(screen.getByTestId('album-input-genre'), { target: { value: 'Rock' } })
    fireEvent.keyDown(screen.getByTestId('album-input-genre'), { key: 'Enter' })
    await waitFor(() => { expect(screen.queryByTestId('album-input-genre')).not.toBeInTheDocument() })

    fireEvent.click(screen.getByTestId('save-button'))
    await waitFor(() => { expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument() })
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'))

    await waitFor(() => {
      const errorEl = screen.getByTestId('batch-save-error')
      expect(errorEl).toBeInTheDocument()
      // Structured code and message from the server are surfaced
      expect(errorEl.textContent).toContain('WRITE_LOCK_CONFLICT')
      expect(errorEl.textContent).toContain('Album is locked by another writer')
    })
  })

  it('clears dirty fields when Discogs sync completes (in edit mode)', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ discogsId: '12345' }))
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('album-value-genre')).toBeInTheDocument()
    })

    // Commit a dirty field
    fireEvent.click(screen.getByTestId('album-value-genre'))
    fireEvent.change(screen.getByTestId('album-input-genre'), { target: { value: 'Rock' } })
    fireEvent.keyDown(screen.getByTestId('album-input-genre'), { key: 'Enter' })
    await waitFor(() => { expect(screen.getByTestId('save-button')).not.toBeDisabled() })

    // Trigger sync complete (which overwrites local edits)
    fireEvent.click(screen.getByTestId('mock-sync-complete'))

    // Dirty fields should be cleared; Save button should be disabled again
    await waitFor(() => {
      expect(screen.getByTestId('save-button')).toBeDisabled()
    })
    expect(screen.queryByTestId('dirty-count')).not.toBeInTheDocument()
  })

  // ──────────────────────────────────────────────
  // Confirmation dialog behaviour
  // ──────────────────────────────────────────────

  it('shows confirmation dialog before the PATCH fires (dialog triggered by Save button)', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    mockAlbumsService.bulkUpdateAlbumTags.mockResolvedValue(makeAlbum({ genre: 'Rock' }))
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('album-value-genre')).toBeInTheDocument()
    })

    // Commit field as dirty via Enter
    fireEvent.click(screen.getByTestId('album-value-genre'))
    fireEvent.change(screen.getByTestId('album-input-genre'), { target: { value: 'Rock' } })
    fireEvent.keyDown(screen.getByTestId('album-input-genre'), { key: 'Enter' })

    // Wait for input to exit edit mode (dirty commit)
    await waitFor(() => {
      expect(screen.queryByTestId('album-input-genre')).not.toBeInTheDocument()
    })

    // Click Save button to trigger dialog; PATCH has NOT been called yet
    fireEvent.click(screen.getByTestId('save-button'))
    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    })
    expect(mockAlbumsService.bulkUpdateAlbumTags).not.toHaveBeenCalled()
  })

  it('dialog shows album title and track count', async () => {
    const album = makeAlbum({
      album: 'Kind of Blue',
      tracks: [makeTrack(), makeTrack({ id: 'track-2', path: '02.flac' })],
    })
    mockAlbumsService.getAlbum.mockResolvedValue(album)
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('album-value-genre')).toBeInTheDocument()
    })

    // Commit as dirty then open dialog via Save button
    fireEvent.click(screen.getByTestId('album-value-genre'))
    fireEvent.change(screen.getByTestId('album-input-genre'), { target: { value: 'Rock' } })
    fireEvent.keyDown(screen.getByTestId('album-input-genre'), { key: 'Enter' })
    await waitFor(() => { expect(screen.queryByTestId('album-input-genre')).not.toBeInTheDocument() })
    fireEvent.click(screen.getByTestId('save-button'))

    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    })

    expect(screen.getByTestId('confirm-dialog')).toHaveTextContent('Kind of Blue')
    expect(screen.getByTestId('confirm-dialog')).toHaveTextContent('2 FLAC files')
  })

  it('dialog shows "This cannot be undone"', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('album-value-genre')).toBeInTheDocument()
    })

    // Commit as dirty then open dialog via Save button
    fireEvent.click(screen.getByTestId('album-value-genre'))
    fireEvent.change(screen.getByTestId('album-input-genre'), { target: { value: 'Rock' } })
    fireEvent.keyDown(screen.getByTestId('album-input-genre'), { key: 'Enter' })
    await waitFor(() => { expect(screen.queryByTestId('album-input-genre')).not.toBeInTheDocument() })
    fireEvent.click(screen.getByTestId('save-button'))

    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog-warning')).toHaveTextContent('This cannot be undone')
    })
  })

  it('Cancel button prevents the PATCH and retains dirty fields for retry', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('album-value-genre')).toBeInTheDocument()
    })

    // Commit as dirty then open dialog via Save button
    fireEvent.click(screen.getByTestId('album-value-genre'))
    fireEvent.change(screen.getByTestId('album-input-genre'), { target: { value: 'Rock' } })
    fireEvent.keyDown(screen.getByTestId('album-input-genre'), { key: 'Enter' })
    await waitFor(() => { expect(screen.queryByTestId('album-input-genre')).not.toBeInTheDocument() })
    fireEvent.click(screen.getByTestId('save-button'))

    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    })

    // Cancel - dialog closes, dirty fields are retained (user can retry Save)
    fireEvent.click(screen.getByTestId('confirm-dialog-cancel'))

    await waitFor(() => {
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
    })

    // PATCH was never called
    expect(mockAlbumsService.bulkUpdateAlbumTags).not.toHaveBeenCalled()
    // Dirty count still shown - the committed value stays pending
    expect(screen.getByTestId('dirty-count')).toBeInTheDocument()
    expect(screen.queryByTestId('album-error-genre')).not.toBeInTheDocument()
  })

  it('Escape on the dialog cancels without firing the PATCH', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('album-value-genre')).toBeInTheDocument()
    })

    // Commit as dirty then open dialog via Save button
    fireEvent.click(screen.getByTestId('album-value-genre'))
    fireEvent.change(screen.getByTestId('album-input-genre'), { target: { value: 'Rock' } })
    fireEvent.keyDown(screen.getByTestId('album-input-genre'), { key: 'Enter' })
    await waitFor(() => { expect(screen.queryByTestId('album-input-genre')).not.toBeInTheDocument() })
    fireEvent.click(screen.getByTestId('save-button'))

    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    })

    // Escape on the dialog
    fireEvent.keyDown(screen.getByTestId('confirm-dialog'), { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
    })

    expect(mockAlbumsService.bulkUpdateAlbumTags).not.toHaveBeenCalled()
    expect(screen.queryByTestId('album-error-genre')).not.toBeInTheDocument()
  })

  it('Confirm button fires the bulk PATCH', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    mockAlbumsService.bulkUpdateAlbumTags.mockResolvedValue(makeAlbum({ genre: 'Rock' }))
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('album-value-genre')).toBeInTheDocument()
    })

    await editAlbumFieldAndConfirm('album-value-genre', 'album-input-genre', 'Rock')

    await waitFor(() => {
      expect(mockAlbumsService.bulkUpdateAlbumTags).toHaveBeenCalledOnce()
    })

    await waitFor(() => {
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
    })
  })

  // ──────────────────────────────────────────────
  // Save button / dirty-field batch-save (#654)
  // ──────────────────────────────────────────────

  it('Save button is disabled when no fields are dirty', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('save-button')).toBeInTheDocument()
    })

    expect(screen.getByTestId('save-button')).toBeDisabled()
  })

  it('Save button becomes enabled after a field is committed via Enter', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('album-value-genre')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('album-value-genre'))
    fireEvent.change(screen.getByTestId('album-input-genre'), { target: { value: 'Rock' } })
    fireEvent.keyDown(screen.getByTestId('album-input-genre'), { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByTestId('save-button')).not.toBeDisabled()
    })
  })

  it('Tab key commits field as dirty and enables Save button', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('album-value-genre')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('album-value-genre'))
    fireEvent.change(screen.getByTestId('album-input-genre'), { target: { value: 'Electronic' } })
    fireEvent.keyDown(screen.getByTestId('album-input-genre'), { key: 'Tab' })

    await waitFor(() => {
      expect(screen.queryByTestId('album-input-genre')).not.toBeInTheDocument()
      expect(screen.getByTestId('save-button')).not.toBeDisabled()
    })
  })

  it('dirty count shows number of uncommitted fields', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('album-value-genre')).toBeInTheDocument()
    })

    // Commit genre as dirty
    fireEvent.click(screen.getByTestId('album-value-genre'))
    fireEvent.change(screen.getByTestId('album-input-genre'), { target: { value: 'Rock' } })
    fireEvent.keyDown(screen.getByTestId('album-input-genre'), { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByTestId('dirty-count')).toBeInTheDocument()
    })
    expect(screen.getByTestId('dirty-count')).toHaveTextContent('1 unsaved change')
  })

  it('Enter on album field commits as dirty without opening dialog', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('album-value-genre')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('album-value-genre'))
    fireEvent.change(screen.getByTestId('album-input-genre'), { target: { value: 'Rock' } })
    fireEvent.keyDown(screen.getByTestId('album-input-genre'), { key: 'Enter' })

    await waitFor(() => {
      expect(screen.queryByTestId('album-input-genre')).not.toBeInTheDocument()
    })

    // No dialog - dirty commit only
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
    // PATCH not called yet
    expect(mockAlbumsService.bulkUpdateAlbumTags).not.toHaveBeenCalled()
  })

  it('Save button sends all dirty fields in one bulk request', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    mockAlbumsService.bulkUpdateAlbumTags.mockResolvedValue(makeAlbum({ genre: 'Rock', label: 'Blue Note' }))
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('album-value-genre')).toBeInTheDocument()
    })

    // Commit genre
    fireEvent.click(screen.getByTestId('album-value-genre'))
    fireEvent.change(screen.getByTestId('album-input-genre'), { target: { value: 'Rock' } })
    fireEvent.keyDown(screen.getByTestId('album-input-genre'), { key: 'Enter' })
    await waitFor(() => { expect(screen.queryByTestId('album-input-genre')).not.toBeInTheDocument() })

    // Commit label
    fireEvent.click(screen.getByTestId('album-value-label'))
    fireEvent.change(screen.getByTestId('album-input-label'), { target: { value: 'Blue Note' } })
    fireEvent.keyDown(screen.getByTestId('album-input-label'), { key: 'Enter' })
    await waitFor(() => { expect(screen.queryByTestId('album-input-label')).not.toBeInTheDocument() })

    // Click Save -> dialog -> confirm
    fireEvent.click(screen.getByTestId('save-button'))
    await waitFor(() => { expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument() })
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'))

    await waitFor(() => {
      // Both fields sent in one bulk request (order may vary as Object.entries order)
      expect(mockAlbumsService.bulkUpdateAlbumTags).toHaveBeenCalledOnce()
      const call = mockAlbumsService.bulkUpdateAlbumTags.mock.calls[0][0] as {
        albumId: string
        requestBody: { albumFields: Array<{ field: string; value: string }>; trackFields: unknown[] }
      }
      expect(call.albumId).toBe('album-id-1')
      expect(call.requestBody.albumFields).toHaveLength(2)
      expect(call.requestBody.albumFields).toEqual(
        expect.arrayContaining([
          { field: 'GENRE', value: 'Rock' },
          { field: 'LABEL', value: 'Blue Note' },
        ])
      )
      expect(call.requestBody.trackFields).toEqual([])
    })
  })

  it('Enter on track field stages edit as dirty without opening dialog or firing network call', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()

    const trackId = 'track-id-1'
    await waitFor(() => {
      expect(screen.getByTestId(`track-${trackId}-value-title`)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId(`track-${trackId}-value-title`))
    fireEvent.change(screen.getByTestId(`track-${trackId}-input-title`), {
      target: { value: 'New Title' },
    })
    fireEvent.keyDown(screen.getByTestId(`track-${trackId}-input-title`), { key: 'Enter' })

    // Input exits edit mode (dirty commit)
    await waitFor(() => {
      expect(screen.queryByTestId(`track-${trackId}-input-title`)).not.toBeInTheDocument()
    })

    // No dialog and no network call yet - only staged as dirty
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
    expect(mockAlbumsService.bulkUpdateAlbumTags).not.toHaveBeenCalled()
  })

  it('Save button becomes enabled after a track field is committed via Enter', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()

    const trackId = 'track-id-1'
    await waitFor(() => {
      expect(screen.getByTestId(`track-${trackId}-value-title`)).toBeInTheDocument()
    })

    // Save button starts disabled
    expect(screen.getByTestId('save-button')).toBeDisabled()

    fireEvent.click(screen.getByTestId(`track-${trackId}-value-title`))
    fireEvent.change(screen.getByTestId(`track-${trackId}-input-title`), {
      target: { value: 'New Title' },
    })
    fireEvent.keyDown(screen.getByTestId(`track-${trackId}-input-title`), { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByTestId('save-button')).not.toBeDisabled()
    })
  })

  it('calls bulkUpdateAlbumTags with track field when track field is committed then saved', async () => {
    const updatedAlbum = makeAlbum({
      tracks: [makeTrack({ title: 'New Title' })],
    })
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    mockAlbumsService.bulkUpdateAlbumTags.mockResolvedValue(updatedAlbum)
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()

    const trackId = 'track-id-1'
    await waitFor(() => {
      expect(screen.getByTestId(`track-${trackId}-value-title`)).toBeInTheDocument()
    })

    // Commit track field as dirty via Enter
    fireEvent.click(screen.getByTestId(`track-${trackId}-value-title`))
    fireEvent.change(screen.getByTestId(`track-${trackId}-input-title`), {
      target: { value: 'New Title' },
    })
    fireEvent.keyDown(screen.getByTestId(`track-${trackId}-input-title`), { key: 'Enter' })
    await waitFor(() => { expect(screen.queryByTestId(`track-${trackId}-input-title`)).not.toBeInTheDocument() })

    // Click Save -> dialog -> confirm
    fireEvent.click(screen.getByTestId('save-button'))
    await waitFor(() => { expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument() })
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'))

    await waitFor(() => {
      expect(mockAlbumsService.bulkUpdateAlbumTags).toHaveBeenCalledWith({
        albumId: 'album-id-1',
        requestBody: {
          albumFields: [],
          trackFields: [{ trackId: 'track-id-1', field: 'TITLE', value: 'New Title' }],
        },
      })
    })
  })

  it('dirty track fields are cleared after successful save', async () => {
    const updatedAlbum = makeAlbum({ tracks: [makeTrack({ title: 'New Title' })] })
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    mockAlbumsService.bulkUpdateAlbumTags.mockResolvedValue(updatedAlbum)
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()

    const trackId = 'track-id-1'
    await waitFor(() => {
      expect(screen.getByTestId(`track-${trackId}-value-title`)).toBeInTheDocument()
    })

    // Commit track field
    fireEvent.click(screen.getByTestId(`track-${trackId}-value-title`))
    fireEvent.change(screen.getByTestId(`track-${trackId}-input-title`), { target: { value: 'New Title' } })
    fireEvent.keyDown(screen.getByTestId(`track-${trackId}-input-title`), { key: 'Enter' })
    await waitFor(() => { expect(screen.getByTestId('save-button')).not.toBeDisabled() })

    // Save and confirm
    fireEvent.click(screen.getByTestId('save-button'))
    await waitFor(() => { expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument() })
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'))

    // Save button is disabled again after clearing dirty fields
    await waitFor(() => {
      expect(screen.getByTestId('save-button')).toBeDisabled()
    })
    expect(screen.queryByTestId('dirty-count')).not.toBeInTheDocument()
  })

  it('retains dirty track fields and shows error when track save fails', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    mockAlbumsService.bulkUpdateAlbumTags.mockRejectedValue(new Error('Server error'))
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()

    const trackId = 'track-id-1'
    await waitFor(() => {
      expect(screen.getByTestId(`track-${trackId}-value-title`)).toBeInTheDocument()
    })

    // Commit track field as dirty
    fireEvent.click(screen.getByTestId(`track-${trackId}-value-title`))
    fireEvent.change(screen.getByTestId(`track-${trackId}-input-title`), { target: { value: 'New Title' } })
    fireEvent.keyDown(screen.getByTestId(`track-${trackId}-input-title`), { key: 'Enter' })
    await waitFor(() => { expect(screen.queryByTestId(`track-${trackId}-input-title`)).not.toBeInTheDocument() })

    // Open dialog and confirm
    fireEvent.click(screen.getByTestId('save-button'))
    await waitFor(() => { expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument() })
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'))

    // After failure: dialog closed, dirty count still visible, error message shown
    await waitFor(() => {
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
    })
    // Dirty count still present (track field retained for retry)
    await waitFor(() => {
      expect(screen.getByTestId('dirty-count')).toBeInTheDocument()
    })
    // Error message displayed
    await waitFor(() => {
      expect(screen.getByTestId('batch-save-error')).toBeInTheDocument()
    })
    // Save button is re-enabled for retry
    expect(screen.getByTestId('save-button')).not.toBeDisabled()
  })

  it('Save button patches both album and track dirty fields in one bulk request', async () => {
    const updatedAlbum = makeAlbum({ genre: 'Rock', tracks: [makeTrack({ title: 'New Title' })] })
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    mockAlbumsService.bulkUpdateAlbumTags.mockResolvedValue(updatedAlbum)
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()

    const trackId = 'track-id-1'
    await waitFor(() => {
      expect(screen.getByTestId('album-value-genre')).toBeInTheDocument()
    })

    // Commit album field
    fireEvent.click(screen.getByTestId('album-value-genre'))
    fireEvent.change(screen.getByTestId('album-input-genre'), { target: { value: 'Rock' } })
    fireEvent.keyDown(screen.getByTestId('album-input-genre'), { key: 'Enter' })
    await waitFor(() => { expect(screen.queryByTestId('album-input-genre')).not.toBeInTheDocument() })

    // Commit track field
    fireEvent.click(screen.getByTestId(`track-${trackId}-value-title`))
    fireEvent.change(screen.getByTestId(`track-${trackId}-input-title`), { target: { value: 'New Title' } })
    fireEvent.keyDown(screen.getByTestId(`track-${trackId}-input-title`), { key: 'Enter' })
    await waitFor(() => { expect(screen.queryByTestId(`track-${trackId}-input-title`)).not.toBeInTheDocument() })

    // Save -> dialog -> confirm
    fireEvent.click(screen.getByTestId('save-button'))
    await waitFor(() => { expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument() })
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'))

    await waitFor(() => {
      expect(mockAlbumsService.bulkUpdateAlbumTags).toHaveBeenCalledWith({
        albumId: 'album-id-1',
        requestBody: {
          albumFields: [{ field: 'GENRE', value: 'Rock' }],
          trackFields: [{ trackId: 'track-id-1', field: 'TITLE', value: 'New Title' }],
        },
      })
    })
  })

  // ──────────────────────────────────────────────
  // Click-to-edit: track level
  // ──────────────────────────────────────────────

  it('shows input when track-level title field is clicked (in edit mode)', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()

    const trackId = 'track-id-1'
    await waitFor(() => {
      expect(screen.getByTestId(`track-${trackId}-value-title`)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTestId(`track-${trackId}-value-title`))
    expect(screen.getByTestId(`track-${trackId}-input-title`)).toHaveValue('So What')
  })

  it('Tab key on track field commits as dirty and enables Save button', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()

    const trackId = 'track-id-1'
    await waitFor(() => {
      expect(screen.getByTestId(`track-${trackId}-value-title`)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId(`track-${trackId}-value-title`))
    fireEvent.change(screen.getByTestId(`track-${trackId}-input-title`), {
      target: { value: 'New Title' },
    })
    fireEvent.keyDown(screen.getByTestId(`track-${trackId}-input-title`), { key: 'Tab' })

    await waitFor(() => {
      expect(screen.queryByTestId(`track-${trackId}-input-title`)).not.toBeInTheDocument()
      expect(screen.getByTestId('save-button')).not.toBeDisabled()
    })
    // No network call yet
    expect(mockAlbumsService.bulkUpdateAlbumTags).not.toHaveBeenCalled()
  })

  it('VA track: ARTIST field is editable per track (in edit mode)', async () => {
    const vaTrack = makeTrack({ artist: 'John Coltrane', id: 'track-va-1' })
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ tracks: [vaTrack] }))
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()

    const trackId = 'track-va-1'
    await waitFor(() => {
      expect(screen.getByTestId(`track-${trackId}-value-artist`)).toBeInTheDocument()
    })
    expect(screen.getByTestId(`track-${trackId}-value-artist`)).toHaveTextContent('John Coltrane')

    fireEvent.click(screen.getByTestId(`track-${trackId}-value-artist`))
    expect(screen.getByTestId(`track-${trackId}-input-artist`)).toHaveValue('John Coltrane')
  })

  // ──────────────────────────────────────────────
  // Tracklist section - empty state (#564)
  // ──────────────────────────────────────────────

  it('shows no-tracks placeholder when album has no tracks (in edit mode)', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ tracks: [] }))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByText('No track information available')).toBeInTheDocument()
    })
  })

  it('does not show no-tracks placeholder when album has tracks (in edit mode)', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ tracks: [makeTrack()] }))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.queryByText('No track information available')).not.toBeInTheDocument()
    })
  })

  // ──────────────────────────────────────────────
  // Tracklist - distinct data per row (#701)
  // ──────────────────────────────────────────────

  it('renders 3 tracks with distinct titles and track numbers (in edit mode)', async () => {
    const tracks = [
      makeTrack({ id: 'track-1', trackNumber: '1', title: 'So What', filePath: '01 So What.flac' }),
      makeTrack({ id: 'track-2', trackNumber: '2', title: 'Freddie Freeloader', filePath: '02 Freddie Freeloader.flac' }),
      makeTrack({ id: 'track-3', trackNumber: '3', title: 'Blue in Green', filePath: '03 Blue in Green.flac' }),
    ]
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ tracks }))
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()

    await waitFor(() => {
      expect(screen.getByTestId('track-row-track-1')).toBeInTheDocument()
    })

    // Each row must show its own title
    expect(screen.getByTestId('track-track-1-value-title')).toHaveTextContent('So What')
    expect(screen.getByTestId('track-track-2-value-title')).toHaveTextContent('Freddie Freeloader')
    expect(screen.getByTestId('track-track-3-value-title')).toHaveTextContent('Blue in Green')

    // Each row must show its own track number
    expect(screen.getByTestId('track-track-1-value-tracknumber')).toHaveTextContent('1')
    expect(screen.getByTestId('track-track-2-value-tracknumber')).toHaveTextContent('2')
    expect(screen.getByTestId('track-track-3-value-tracknumber')).toHaveTextContent('3')

    // Each row has its own info button (file path is behind popover - not visible by default)
    expect(screen.getByTestId('track-track-1-file-path-btn')).toBeInTheDocument()
    expect(screen.getByTestId('track-track-2-file-path-btn')).toBeInTheDocument()
    expect(screen.getByTestId('track-track-3-file-path-btn')).toBeInTheDocument()
  })

  it('renders distinct rows when tracks have duplicate IDs (filePath+index key formula)', async () => {
    const tracks = [
      makeTrack({ id: 'track-same-id', trackNumber: '1', title: 'So What', filePath: '01 So What.flac' }),
      makeTrack({ id: 'track-same-id', trackNumber: '2', title: 'Freddie Freeloader', filePath: '02 Freddie Freeloader.flac' }),
      makeTrack({ id: 'track-same-id', trackNumber: '3', title: 'Blue in Green', filePath: '03 Blue in Green.flac' }),
    ]
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ tracks }))
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()

    // All 3 rows must be present (duplicate IDs produce multiple elements with the same testId)
    await waitFor(() => {
      expect(screen.getAllByTestId('track-row-track-same-id')).toHaveLength(3)
    })

    // Each row must show its own distinct title
    const titleEls = screen.getAllByTestId('track-track-same-id-value-title')
    expect(titleEls).toHaveLength(3)
    expect(titleEls[0]).toHaveTextContent('So What')
    expect(titleEls[1]).toHaveTextContent('Freddie Freeloader')
    expect(titleEls[2]).toHaveTextContent('Blue in Green')

    // Each row must show its own distinct track number
    const trackNumEls = screen.getAllByTestId('track-track-same-id-value-tracknumber')
    expect(trackNumEls).toHaveLength(3)
    expect(trackNumEls[0]).toHaveTextContent('1')
    expect(trackNumEls[1]).toHaveTextContent('2')
    expect(trackNumEls[2]).toHaveTextContent('3')

    // Each row has its own info button (file paths are behind popovers - not visible by default)
    const filePathBtns = screen.getAllByTestId('track-track-same-id-file-path-btn')
    expect(filePathBtns).toHaveLength(3)
  })

  // ──────────────────────────────────────────────
  // Tracklist section - multi-disc grouping (#564)
  // ──────────────────────────────────────────────

  it('renders disc header for multi-disc album (in edit mode)', async () => {
    const disc1Track = makeTrack({ id: 'track-d1', discNumber: '1', trackNumber: '1' })
    const disc2Track = makeTrack({ id: 'track-d2', discNumber: '2', trackNumber: '1', path: '02 disc2.flac' })
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ tracks: [disc1Track, disc2Track] }))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('track-row-track-d1')).toBeInTheDocument()
    })
    expect(screen.getByText('Disc 1')).toBeInTheDocument()
    expect(screen.getByText('Disc 2')).toBeInTheDocument()
  })

  it('does not render disc headers for single-disc album (in edit mode)', async () => {
    const track = makeTrack({ discNumber: undefined })
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ tracks: [track] }))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('track-row-track-id-1')).toBeInTheDocument()
    })
    expect(screen.queryByText(/^Disc /)).not.toBeInTheDocument()
  })

  it('renders Position column header (in edit mode)', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ tracks: [makeTrack()] }))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByRole('columnheader', { name: 'Position' })).toBeInTheDocument()
    })
  })

  // ──────────────────────────────────────────────
  // Path display (#578)
  // ──────────────────────────────────────────────

  it('renders album path as read-only text (in edit mode)', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ albumPath: 'Jazz/Miles Davis/Kind of Blue' }))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('album-path')).toBeInTheDocument()
    })
    expect(screen.getByTestId('album-path')).toHaveTextContent('Jazz/Miles Davis/Kind of Blue')
  })

  it('renders Copy button for album path (in edit mode)', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ albumPath: 'Jazz/Miles Davis/Kind of Blue' }))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('album-path-copy')).toBeInTheDocument()
    })
    const copyBtn = screen.getByTestId('album-path-copy')
    expect(copyBtn).toHaveAttribute('aria-label')
  })

  it('file path is hidden by default and shown in popover after clicking info button (in edit mode)', async () => {
    const track = makeTrack({ id: 'track-id-1', filePath: '01 So What.flac' })
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ tracks: [track] }))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('track-track-id-1-file-path-btn')).toBeInTheDocument()
    })
    // File path not shown by default
    expect(screen.queryByTestId('track-track-id-1-file-path')).not.toBeInTheDocument()
    // Click the info button to reveal file path in popover
    fireEvent.click(screen.getByTestId('track-track-id-1-file-path-btn'))
    await waitFor(() => {
      expect(screen.getByTestId('track-track-id-1-file-path')).toBeInTheDocument()
    })
    expect(screen.getByTestId('track-track-id-1-file-path')).toHaveTextContent('01 So What.flac')
  })

  it('info button has accessible aria-label for the track (in edit mode)', async () => {
    const track = makeTrack({ id: 'track-id-1', title: 'So What', filePath: '01 So What.flac' })
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ tracks: [track] }))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('track-track-id-1-file-path-btn')).toBeInTheDocument()
    })
    const btn = screen.getByTestId('track-track-id-1-file-path-btn')
    expect(btn).toHaveAttribute('aria-label')
    expect(btn.getAttribute('aria-label')).toContain('So What')
  })

  it('file path popover renders with onClose wired - popover element present when open (in edit mode)', async () => {
    const track = makeTrack({ id: 'track-id-1', filePath: '01 So What.flac' })
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ tracks: [track] }))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('track-track-id-1-file-path-btn')).toBeInTheDocument()
    })
    // Popover not present before interaction
    expect(screen.queryByTestId('track-track-id-1-file-popover')).not.toBeInTheDocument()
    // Open popover
    fireEvent.click(screen.getByTestId('track-track-id-1-file-path-btn'))
    await waitFor(() => {
      expect(screen.getByTestId('track-track-id-1-file-popover')).toBeInTheDocument()
    })
    expect(screen.getByTestId('track-track-id-1-file-path')).toBeInTheDocument()
  })

  it('Copy button for track filePath is shown after opening the file path popover (in edit mode)', async () => {
    const track = makeTrack({ id: 'track-id-1', filePath: '01 So What.flac' })
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ tracks: [track] }))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('track-track-id-1-file-path-btn')).toBeInTheDocument()
    })
    // Open popover
    fireEvent.click(screen.getByTestId('track-track-id-1-file-path-btn'))
    await waitFor(() => {
      expect(screen.getByTestId('track-track-id-1-file-path-copy')).toBeInTheDocument()
    })
    const copyBtn = screen.getByTestId('track-track-id-1-file-path-copy')
    expect(copyBtn).toHaveAttribute('aria-label')
  })

  it('File column header is not rendered as visible column in tracks table (in edit mode)', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ tracks: [makeTrack()] }))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByRole('columnheader', { name: 'Position' })).toBeInTheDocument()
    })
    // File column is no longer a visible column header
    expect(screen.queryByRole('columnheader', { name: 'File' })).not.toBeInTheDocument()
  })

  it('renders paths with special chars and spaces correctly (in edit mode)', async () => {
    const path = "Jazz & Blues (Miles Davis's)/Kind of Blue"
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ albumPath: path }))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('album-path')).toBeInTheDocument()
    })
    expect(screen.getByTestId('album-path')).toHaveTextContent(path)
  })

  // ──────────────────────────────────────────────
  // Two-column layout (#579)
  // ──────────────────────────────────────────────

  it('renders two-column layout container with metadata and tracklist columns (in edit mode)', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('two-column-layout')).toBeInTheDocument()
    })
    expect(screen.getByTestId('metadata-column')).toBeInTheDocument()
    expect(screen.getByTestId('tracklist-column')).toBeInTheDocument()
  })

  it('places album tags section inside the metadata column (in edit mode)', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('album-value-album')).toBeInTheDocument()
    })
    const metadataCol = screen.getByTestId('metadata-column')
    expect(metadataCol).toContainElement(screen.getByTestId('album-value-album'))
  })

  it('places tracks section inside the tracklist column (in edit mode)', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('track-row-track-id-1')).toBeInTheDocument()
    })
    const tracklistCol = screen.getByTestId('tracklist-column')
    expect(tracklistCol).toContainElement(screen.getByTestId('track-row-track-id-1'))
  })

  it('back button is present in both view mode and edit mode', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('back-button')).toBeInTheDocument()
    })
    // Back button present in view mode
    expect(screen.getByTestId('back-button')).toBeInTheDocument()
    await enterEditMode()
    // Back button still present in edit mode
    expect(screen.getByTestId('back-button')).toBeInTheDocument()
  })

  it('renders the read-only Other tags section with an empty state (in edit mode)', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('other-tags-section')).toBeInTheDocument()
    })
    // Section heading present and the empty-state notice rendered (read-only in v1)
    expect(screen.getByRole('heading', { name: 'Other tags' })).toBeInTheDocument()
    expect(screen.getByTestId('other-tags-empty')).toHaveTextContent('No additional tags')
  })

  it('SyncPanel is placed inside the metadata column when discogsId is set (in edit mode)', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ discogsId: '42' }))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('sync-panel')).toBeInTheDocument()
    })
    const metadataCol = screen.getByTestId('metadata-column')
    expect(metadataCol).toContainElement(screen.getByTestId('sync-panel'))
  })
})

// ---------------------------------------------------------------------------
// Genre style chips (#881)
// ---------------------------------------------------------------------------

describe('AlbumDetail - genre chips', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a single chip when genre has one value', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ genre: 'Jazz' }))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('hero-genre-chips')).toBeInTheDocument()
    })
    // One chip for "Jazz"
    expect(screen.getByTestId('hero-genre-chips')).toHaveTextContent('Jazz')
  })

  it('renders multiple chips when genre is comma-separated', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ genre: 'Downtempo, Ambient, IDM, Experimental' }))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('hero-genre-chips')).toBeInTheDocument()
    })
    const chipsContainer = screen.getByTestId('hero-genre-chips')
    expect(chipsContainer).toHaveTextContent('Downtempo')
    expect(chipsContainer).toHaveTextContent('Ambient')
    expect(chipsContainer).toHaveTextContent('IDM')
    expect(chipsContainer).toHaveTextContent('Experimental')
    // Should not contain the raw comma-separated string as one element
    expect(chipsContainer.textContent).not.toBe('Downtempo, Ambient, IDM, Experimental')
  })

  it('trims whitespace from each chip value', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ genre: '  Rock  ,  Blues  ' }))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('hero-genre-chips')).toBeInTheDocument()
    })
    const chipsContainer = screen.getByTestId('hero-genre-chips')
    expect(chipsContainer).toHaveTextContent('Rock')
    expect(chipsContainer).toHaveTextContent('Blues')
    // No leading/trailing whitespace in displayed values
    expect(chipsContainer.textContent).not.toContain('  Rock')
  })

  it('does not render genre chips when genre contains only whitespace and commas', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ genre: ' ,  , ' }))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('hero-genre-chips')).not.toBeInTheDocument()
  })

  it('does not render genre chips when genre is undefined', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ genre: undefined }))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('hero-genre-chips')).not.toBeInTheDocument()
  })

  it('genre chips are in the hero header', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ genre: 'Electronic' }))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('hero-genre-chips')).toBeInTheDocument()
    })
    const heroHeader = screen.getByTestId('album-hero-header')
    expect(heroHeader).toContainElement(screen.getByTestId('hero-genre-chips'))
  })

  it('editable GENRE field still shows the raw comma-separated value for editing (in edit mode)', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ genre: 'Downtempo, Ambient' }))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('album-value-genre')).toBeInTheDocument()
    })
    // The editable field still shows the full raw string
    expect(screen.getByTestId('album-value-genre')).toHaveTextContent('Downtempo, Ambient')
    // Clicking it opens an input with the raw value
    fireEvent.click(screen.getByTestId('album-value-genre'))
    expect(screen.getByTestId('album-input-genre')).toHaveValue('Downtempo, Ambient')
  })
})

// ---------------------------------------------------------------------------
// Navigation guard (back navigation with unsaved dirty fields)
// ---------------------------------------------------------------------------

describe('AlbumDetail - navigation guard (dirty fields)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not show nav guard dialog when no fields are dirty and Back is clicked', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('back-button')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('back-button'))

    // Nav guard must not appear
    expect(screen.queryByTestId('nav-guard-dialog')).not.toBeInTheDocument()
    // Should have navigated to list page
    await waitFor(() => {
      expect(screen.getByTestId('list-page')).toBeInTheDocument()
    })
  })

  it('shows nav guard dialog when there are dirty fields and Back is clicked (in edit mode)', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('album-value-album')).toBeInTheDocument()
    })

    // Commit a dirty field via Enter (no network request)
    fireEvent.click(screen.getByTestId('album-value-album'))
    fireEvent.change(screen.getByTestId('album-input-album'), { target: { value: 'New Title' } })
    fireEvent.keyDown(screen.getByTestId('album-input-album'), { key: 'Enter' })

    await waitFor(() => {
      expect(screen.queryByTestId('album-input-album')).not.toBeInTheDocument()
    })

    // Click Back - should trigger blocker
    fireEvent.click(screen.getByTestId('back-button'))

    await waitFor(() => {
      expect(screen.getByTestId('nav-guard-dialog')).toBeInTheDocument()
    })
  })

  it('navigates away when user confirms leaving with dirty fields', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('album-value-album')).toBeInTheDocument()
    })

    // Commit a dirty field
    fireEvent.click(screen.getByTestId('album-value-album'))
    fireEvent.change(screen.getByTestId('album-input-album'), { target: { value: 'New Title' } })
    fireEvent.keyDown(screen.getByTestId('album-input-album'), { key: 'Enter' })

    await waitFor(() => {
      expect(screen.queryByTestId('album-input-album')).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('back-button'))

    await waitFor(() => {
      expect(screen.getByTestId('nav-guard-dialog')).toBeInTheDocument()
    })

    // Confirm: leave anyway
    fireEvent.click(screen.getByTestId('nav-guard-confirm'))

    // Should navigate to the list page
    await waitFor(() => {
      expect(screen.getByTestId('list-page')).toBeInTheDocument()
    })
  })

  it('stays on album detail when user cancels navigation from nav guard dialog', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('album-value-album')).toBeInTheDocument()
    })

    // Commit a dirty field
    fireEvent.click(screen.getByTestId('album-value-album'))
    fireEvent.change(screen.getByTestId('album-input-album'), { target: { value: 'New Title' } })
    fireEvent.keyDown(screen.getByTestId('album-input-album'), { key: 'Enter' })

    await waitFor(() => {
      expect(screen.queryByTestId('album-input-album')).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('back-button'))

    await waitFor(() => {
      expect(screen.getByTestId('nav-guard-dialog')).toBeInTheDocument()
    })

    // Cancel: stay on page
    fireEvent.click(screen.getByTestId('nav-guard-cancel'))

    await waitFor(() => {
      expect(screen.queryByTestId('nav-guard-dialog')).not.toBeInTheDocument()
    })

    // Still on album detail page (in edit mode with dirty count)
    expect(screen.getByTestId('album-value-album')).toBeInTheDocument()
    // Dirty count must still be visible (changes preserved)
    expect(screen.getByTestId('dirty-count')).toBeInTheDocument()
  })

  it('does not show nav guard after batch save clears dirty fields', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    mockAlbumsService.bulkUpdateAlbumTags.mockResolvedValue(makeAlbum({ album: 'New Title' }))
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('album-value-album')).toBeInTheDocument()
    })

    // Commit a dirty field then save
    fireEvent.click(screen.getByTestId('album-value-album'))
    fireEvent.change(screen.getByTestId('album-input-album'), { target: { value: 'New Title' } })
    fireEvent.keyDown(screen.getByTestId('album-input-album'), { key: 'Enter' })

    await waitFor(() => {
      expect(screen.queryByTestId('album-input-album')).not.toBeInTheDocument()
    })

    // Save and confirm
    fireEvent.click(screen.getByTestId('save-button'))
    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'))

    // Wait for dirty count to disappear (fields cleared after save)
    await waitFor(() => {
      expect(screen.queryByTestId('dirty-count')).not.toBeInTheDocument()
    })

    // Flush pending effects so react-router's useBlocker re-registers with the
    // now-cleared (non-dirty) condition before we navigate.
    await act(async () => {
      await Promise.resolve()
    })

    // Now clicking Back should NOT trigger the nav guard; navigation proceeds
    // straight to the list page.
    fireEvent.click(screen.getByTestId('back-button'))
    await waitFor(() => {
      expect(screen.getByTestId('list-page')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('nav-guard-dialog')).not.toBeInTheDocument()
  })

  it('shows nav guard dialog when there are dirty track fields and Back is clicked', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()

    const trackId = 'track-id-1'
    await waitFor(() => {
      expect(screen.getByTestId(`track-${trackId}-value-title`)).toBeInTheDocument()
    })

    // Commit a track field as dirty
    fireEvent.click(screen.getByTestId(`track-${trackId}-value-title`))
    fireEvent.change(screen.getByTestId(`track-${trackId}-input-title`), { target: { value: 'New Title' } })
    fireEvent.keyDown(screen.getByTestId(`track-${trackId}-input-title`), { key: 'Enter' })

    await waitFor(() => {
      expect(screen.queryByTestId(`track-${trackId}-input-title`)).not.toBeInTheDocument()
    })

    // Click Back - should trigger blocker due to dirty track field
    fireEvent.click(screen.getByTestId('back-button'))

    await waitFor(() => {
      expect(screen.getByTestId('nav-guard-dialog')).toBeInTheDocument()
    })
  })

  it('pressing Escape on nav guard dialog keeps user on album detail page with dirty changes intact', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('album-value-album')).toBeInTheDocument()
    })

    // Commit a dirty field
    fireEvent.click(screen.getByTestId('album-value-album'))
    fireEvent.change(screen.getByTestId('album-input-album'), { target: { value: 'New Title' } })
    fireEvent.keyDown(screen.getByTestId('album-input-album'), { key: 'Enter' })

    await waitFor(() => {
      expect(screen.queryByTestId('album-input-album')).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('back-button'))

    await waitFor(() => {
      expect(screen.getByTestId('nav-guard-dialog')).toBeInTheDocument()
    })

    // Press Escape - equivalent to Cancel (stay on page)
    fireEvent.keyDown(screen.getByTestId('nav-guard-dialog'), { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByTestId('nav-guard-dialog')).not.toBeInTheDocument()
    })

    // Still on album detail page with dirty count visible
    expect(screen.getByTestId('album-value-album')).toBeInTheDocument()
    expect(screen.getByTestId('dirty-count')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Classical attribution (#884)
// ---------------------------------------------------------------------------

describe('AlbumDetail - classical attribution in track title cell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows "Artist - Title" in title cell when track artist differs from album artist (in edit mode)', async () => {
    const track = makeTrack({ id: 'track-c1', artist: 'Beethoven', title: 'Fur Elise', filePath: '01 Fur Elise.flac' })
    mockAlbumsService.getAlbum.mockResolvedValue(
      makeAlbum({ albumArtist: 'Lang Lang', tracks: [track] })
    )
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()

    await waitFor(() => {
      expect(screen.getByTestId('track-track-c1-value-title')).toBeInTheDocument()
    })

    expect(screen.getByTestId('track-track-c1-value-title')).toHaveTextContent('Beethoven - Fur Elise')
  })

  it('shows only title when track has no artist tag (in edit mode)', async () => {
    const track = makeTrack({ id: 'track-c2', artist: undefined, title: 'Aquarius', filePath: '01 Aquarius.flac' })
    mockAlbumsService.getAlbum.mockResolvedValue(
      makeAlbum({ albumArtist: 'Boards of Canada', tracks: [track] })
    )
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()

    await waitFor(() => {
      expect(screen.getByTestId('track-track-c2-value-title')).toBeInTheDocument()
    })

    expect(screen.getByTestId('track-track-c2-value-title')).toHaveTextContent('Aquarius')
    expect(screen.getByTestId('track-track-c2-value-title')).not.toHaveTextContent(' - ')
  })

  it('shows only title when track artist equals album artist (in edit mode)', async () => {
    const track = makeTrack({ id: 'track-c3', artist: 'Boards of Canada', title: 'Music is Math', filePath: '02 Music is Math.flac' })
    mockAlbumsService.getAlbum.mockResolvedValue(
      makeAlbum({ albumArtist: 'Boards of Canada', tracks: [track] })
    )
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()

    await waitFor(() => {
      expect(screen.getByTestId('track-track-c3-value-title')).toBeInTheDocument()
    })

    expect(screen.getByTestId('track-track-c3-value-title')).toHaveTextContent('Music is Math')
    expect(screen.getByTestId('track-track-c3-value-title')).not.toHaveTextContent('Boards of Canada -')
  })

  it('renders trailing asterisk in artist prefix as-is (Discogs asterisk notation)', async () => {
    const track = makeTrack({ id: 'track-c4', artist: 'Beethoven*', title: 'Fur Elise', filePath: '01 Fur Elise.flac' })
    mockAlbumsService.getAlbum.mockResolvedValue(
      makeAlbum({ albumArtist: 'Lang Lang', tracks: [track] })
    )
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()

    await waitFor(() => {
      expect(screen.getByTestId('track-track-c4-value-title')).toBeInTheDocument()
    })

    expect(screen.getByTestId('track-track-c4-value-title')).toHaveTextContent('Beethoven* - Fur Elise')
  })

  it('TITLE EditableField value is only the track title when entering edit mode (no prefix)', async () => {
    const track = makeTrack({ id: 'track-c5', artist: 'Beethoven', title: 'Fur Elise', filePath: '01 Fur Elise.flac' })
    mockAlbumsService.getAlbum.mockResolvedValue(
      makeAlbum({ albumArtist: 'Lang Lang', tracks: [track] })
    )
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()

    await waitFor(() => {
      expect(screen.getByTestId('track-track-c5-value-title')).toBeInTheDocument()
    })

    // Click to enter edit mode (within the editable field, not the page mode)
    fireEvent.click(screen.getByTestId('track-track-c5-value-title'))

    // Input should contain only the raw title, not the attribution prefix
    await waitFor(() => {
      expect(screen.getByTestId('track-track-c5-input-title')).toBeInTheDocument()
    })
    expect(screen.getByTestId('track-track-c5-input-title')).toHaveValue('Fur Elise')
  })
})

// ---------------------------------------------------------------------------
// View/Edit mode toggle (#910)
// ---------------------------------------------------------------------------

describe('AlbumDetail - view/edit mode toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts in view mode by default', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('save-button')).not.toBeInTheDocument()
    expect(screen.queryByTestId('cancel-edit-button')).not.toBeInTheDocument()
    expect(screen.queryByTestId('album-value-album')).not.toBeInTheDocument()
  })

  it('switches to edit mode when Edit button is clicked', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTestId('edit-button'))
    await waitFor(() => {
      expect(screen.getByTestId('cancel-edit-button')).toBeInTheDocument()
    })
    expect(screen.getByTestId('save-button')).toBeInTheDocument()
    expect(screen.queryByTestId('edit-button')).not.toBeInTheDocument()
  })

  it('returns to view mode when Cancel is clicked with no dirty fields', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    fireEvent.click(screen.getByTestId('cancel-edit-button'))
    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('cancel-edit-button')).not.toBeInTheDocument()
    expect(screen.queryByTestId('save-button')).not.toBeInTheDocument()
  })

  it('shows cancel guard dialog when Cancel is clicked with dirty fields', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('album-value-genre')).toBeInTheDocument()
    })

    // Make a dirty change
    fireEvent.click(screen.getByTestId('album-value-genre'))
    fireEvent.change(screen.getByTestId('album-input-genre'), { target: { value: 'Rock' } })
    fireEvent.keyDown(screen.getByTestId('album-input-genre'), { key: 'Enter' })
    await waitFor(() => { expect(screen.queryByTestId('album-input-genre')).not.toBeInTheDocument() })

    // Click Cancel - should show the guard because fields are dirty
    fireEvent.click(screen.getByTestId('cancel-edit-button'))
    await waitFor(() => {
      expect(screen.getByTestId('nav-guard-dialog')).toBeInTheDocument()
    })
    // Still in edit mode - guard is showing
    expect(screen.getByTestId('cancel-edit-button')).toBeInTheDocument()
  })

  it('returns to view mode and discards dirty state when cancel guard is confirmed', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('album-value-genre')).toBeInTheDocument()
    })

    // Make a dirty change
    fireEvent.click(screen.getByTestId('album-value-genre'))
    fireEvent.change(screen.getByTestId('album-input-genre'), { target: { value: 'Rock' } })
    fireEvent.keyDown(screen.getByTestId('album-input-genre'), { key: 'Enter' })
    await waitFor(() => { expect(screen.queryByTestId('album-input-genre')).not.toBeInTheDocument() })
    expect(screen.getByTestId('dirty-count')).toBeInTheDocument()

    // Click Cancel -> guard appears -> confirm
    fireEvent.click(screen.getByTestId('cancel-edit-button'))
    await waitFor(() => {
      expect(screen.getByTestId('nav-guard-dialog')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTestId('nav-guard-confirm'))

    // Should return to view mode with no dirty state
    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('dirty-count')).not.toBeInTheDocument()
    expect(screen.queryByTestId('cancel-edit-button')).not.toBeInTheDocument()
  })

  it('stays in edit mode with dirty fields when cancel guard is dismissed', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })
    await enterEditMode()
    await waitFor(() => {
      expect(screen.getByTestId('album-value-genre')).toBeInTheDocument()
    })

    // Make a dirty change
    fireEvent.click(screen.getByTestId('album-value-genre'))
    fireEvent.change(screen.getByTestId('album-input-genre'), { target: { value: 'Rock' } })
    fireEvent.keyDown(screen.getByTestId('album-input-genre'), { key: 'Enter' })
    await waitFor(() => { expect(screen.queryByTestId('album-input-genre')).not.toBeInTheDocument() })

    // Click Cancel -> guard appears -> dismiss (stay in edit mode)
    fireEvent.click(screen.getByTestId('cancel-edit-button'))
    await waitFor(() => {
      expect(screen.getByTestId('nav-guard-dialog')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTestId('nav-guard-cancel'))

    await waitFor(() => {
      expect(screen.queryByTestId('nav-guard-dialog')).not.toBeInTheDocument()
    })

    // Still in edit mode with dirty fields
    expect(screen.getByTestId('cancel-edit-button')).toBeInTheDocument()
    expect(screen.getByTestId('dirty-count')).toBeInTheDocument()
  })
})
