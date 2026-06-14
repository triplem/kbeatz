import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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
 * Helper: open edit mode for a field, type a new value, press Enter to commit dirty,
 * then click the Save button, then click Confirm in the dialog.
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
  // Initial render
  // ──────────────────────────────────────────────

  it('shows loading state initially', () => {
    mockAlbumsService.getAlbum.mockReturnValue(new Promise(() => undefined))
    renderDetail()
    expect(screen.getByText(/Loading album/)).toBeInTheDocument()
  })

  it('renders album fields after loading', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()
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
      expect(screen.getByTestId('album-cover')).toBeInTheDocument()
    })
    const img = screen.getByTestId('album-cover')
    expect(img).toHaveAttribute('loading', 'lazy')
    expect(img).toHaveAttribute('src', '/api/v1/albums/album-id-1/cover')
  })

  it('does not render cover image when hasCoverArt is false', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ hasCoverArt: false }))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('album-value-album')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('album-cover')).not.toBeInTheDocument()
  })

  it('renders error state when fetch fails', async () => {
    mockAlbumsService.getAlbum.mockRejectedValue(new Error('Network error'))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Network error')
    })
  })

  it('renders tracks table with editable track fields', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()
    await waitFor(() => {
      expect(screen.getByText(/Tracks/)).toBeInTheDocument()
    })
    const trackId = 'track-id-1'
    expect(screen.getByTestId(`track-${trackId}-value-title`)).toHaveTextContent('So What')
  })

  it('renders all 9 album-level editable fields', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(
      makeAlbum({
        composer: 'Miles Davis',
        conductor: 'Rattle',
        ensemble: 'LSO',
      }),
    )
    renderDetail()
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

  it('renders SyncPanel when album has a discogsId', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ discogsId: '12345' }))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('sync-panel')).toBeInTheDocument()
    })
    expect(screen.getByTestId('sync-panel')).toHaveAttribute('data-discogs-id', '12345')
  })

  it('does NOT render SyncPanel when album has no discogsId', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ discogsId: undefined }))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('album-value-album')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('sync-panel')).not.toBeInTheDocument()
  })

  it('updates album tags when onSyncComplete is called', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ discogsId: '12345' }))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('sync-panel')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('mock-sync-complete'))

    await waitFor(() => {
      expect(screen.getByTestId('album-value-albumartist')).toHaveTextContent('Updated Artist')
      expect(screen.getByTestId('album-value-album')).toHaveTextContent('Updated Album')
    })
  })

  // ──────────────────────────────────────────────
  // Click-to-edit: album level
  // ──────────────────────────────────────────────

  it('shows input when album-level field is clicked', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('album-value-genre')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTestId('album-value-genre'))
    expect(screen.getByTestId('album-input-genre')).toHaveValue('Jazz')
  })

  it('calls updateAlbumTags and updates album after confirmation', async () => {
    const updatedAlbum = makeAlbum({ genre: 'Progressive Rock' })
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    mockAlbumsService.updateAlbumTags.mockResolvedValue(updatedAlbum)
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('album-value-genre')).toBeInTheDocument()
    })

    await editAlbumFieldAndConfirm('album-value-genre', 'album-input-genre', 'Progressive Rock')

    await waitFor(() => {
      expect(mockAlbumsService.updateAlbumTags).toHaveBeenCalledWith({
        albumId: 'album-id-1',
        requestBody: { field: 'GENRE', value: 'Progressive Rock' },
      })
    })
  })

  it('Escape cancels edit and makes no API call (no dialog shown)', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()

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
    mockAlbumsService.updateAlbumTags.mockRejectedValue(new Error('Server error'))
    renderDetail()

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
    // Error message displayed
    await waitFor(() => {
      expect(screen.getByTestId('batch-save-error')).toBeInTheDocument()
    })
  })

  it('clears dirty fields when Discogs sync completes', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ discogsId: '12345' }))
    renderDetail()

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
    mockAlbumsService.updateAlbumTags.mockResolvedValue(makeAlbum({ genre: 'Rock' }))
    renderDetail()

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
    expect(mockAlbumsService.updateAlbumTags).not.toHaveBeenCalled()
  })

  it('dialog shows album title and track count', async () => {
    const album = makeAlbum({
      album: 'Kind of Blue',
      tracks: [makeTrack(), makeTrack({ id: 'track-2', path: '02.flac' })],
    })
    mockAlbumsService.getAlbum.mockResolvedValue(album)
    renderDetail()

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
    expect(mockAlbumsService.updateAlbumTags).not.toHaveBeenCalled()
    // Dirty count still shown - the committed value stays pending
    expect(screen.getByTestId('dirty-count')).toBeInTheDocument()
    expect(screen.queryByTestId('album-error-genre')).not.toBeInTheDocument()
  })

  it('Escape on the dialog cancels without firing the PATCH', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()

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

    expect(mockAlbumsService.updateAlbumTags).not.toHaveBeenCalled()
    expect(screen.queryByTestId('album-error-genre')).not.toBeInTheDocument()
  })

  it('Confirm button fires the PATCH', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    mockAlbumsService.updateAlbumTags.mockResolvedValue(makeAlbum({ genre: 'Rock' }))
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('album-value-genre')).toBeInTheDocument()
    })

    await editAlbumFieldAndConfirm('album-value-genre', 'album-input-genre', 'Rock')

    await waitFor(() => {
      expect(mockAlbumsService.updateAlbumTags).toHaveBeenCalledOnce()
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
      expect(screen.getByTestId('save-button')).toBeInTheDocument()
    })

    expect(screen.getByTestId('save-button')).toBeDisabled()
  })

  it('Save button becomes enabled after a field is committed via Enter', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()

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
    expect(mockAlbumsService.updateAlbumTags).not.toHaveBeenCalled()
  })

  it('Save button sends all dirty fields in sequence', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    mockAlbumsService.updateAlbumTags.mockResolvedValue(makeAlbum({ genre: 'Rock', label: 'Blue Note' }))
    renderDetail()

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
      expect(mockAlbumsService.updateAlbumTags).toHaveBeenCalledTimes(2)
    })
  })

  it('confirmation dialog is NOT shown for track-level field saves', async () => {
    const updatedAlbum = makeAlbum({ tracks: [makeTrack({ title: 'New Title' })] })
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    mockAlbumsService.updateTrackTags.mockResolvedValue(updatedAlbum)
    renderDetail()

    const trackId = 'track-id-1'
    await waitFor(() => {
      expect(screen.getByTestId(`track-${trackId}-value-title`)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId(`track-${trackId}-value-title`))
    fireEvent.change(screen.getByTestId(`track-${trackId}-input-title`), {
      target: { value: 'New Title' },
    })
    fireEvent.keyDown(screen.getByTestId(`track-${trackId}-input-title`), { key: 'Enter' })

    // No confirmation dialog for track-level edits
    await waitFor(() => {
      expect(mockAlbumsService.updateTrackTags).toHaveBeenCalledWith({
        albumId: 'album-id-1',
        trackId: 'track-id-1',
        requestBody: { field: 'TITLE', value: 'New Title' },
      })
    })
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
  })

  // ──────────────────────────────────────────────
  // Click-to-edit: track level
  // ──────────────────────────────────────────────

  it('shows input when track-level title field is clicked', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()
    const trackId = 'track-id-1'
    await waitFor(() => {
      expect(screen.getByTestId(`track-${trackId}-value-title`)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTestId(`track-${trackId}-value-title`))
    expect(screen.getByTestId(`track-${trackId}-input-title`)).toHaveValue('So What')
  })

  it('calls updateTrackTags when track field is saved', async () => {
    const updatedAlbum = makeAlbum({
      tracks: [makeTrack({ title: 'New Title' })],
    })
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    mockAlbumsService.updateTrackTags.mockResolvedValue(updatedAlbum)
    renderDetail()

    const trackId = 'track-id-1'
    await waitFor(() => {
      expect(screen.getByTestId(`track-${trackId}-value-title`)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId(`track-${trackId}-value-title`))
    fireEvent.change(screen.getByTestId(`track-${trackId}-input-title`), {
      target: { value: 'New Title' },
    })
    fireEvent.keyDown(screen.getByTestId(`track-${trackId}-input-title`), { key: 'Enter' })

    await waitFor(() => {
      expect(mockAlbumsService.updateTrackTags).toHaveBeenCalledWith({
        albumId: 'album-id-1',
        trackId: 'track-id-1',
        requestBody: { field: 'TITLE', value: 'New Title' },
      })
    })
  })

  it('VA track: ARTIST field is editable per track', async () => {
    const vaTrack = makeTrack({ artist: 'John Coltrane', id: 'track-va-1' })
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ tracks: [vaTrack] }))
    renderDetail()

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

  it('shows no-tracks placeholder when album has no tracks', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ tracks: [] }))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByText('No track information available')).toBeInTheDocument()
    })
  })

  it('does not show no-tracks placeholder when album has tracks', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ tracks: [makeTrack()] }))
    renderDetail()
    await waitFor(() => {
      expect(screen.queryByText('No track information available')).not.toBeInTheDocument()
    })
  })

  // ──────────────────────────────────────────────
  // Tracklist section - multi-disc grouping (#564)
  // ──────────────────────────────────────────────

  it('renders disc header for multi-disc album', async () => {
    const disc1Track = makeTrack({ id: 'track-d1', discNumber: '1', trackNumber: '1' })
    const disc2Track = makeTrack({ id: 'track-d2', discNumber: '2', trackNumber: '1', path: '02 disc2.flac' })
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ tracks: [disc1Track, disc2Track] }))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('track-row-track-d1')).toBeInTheDocument()
    })
    expect(screen.getByText('Disc 1')).toBeInTheDocument()
    expect(screen.getByText('Disc 2')).toBeInTheDocument()
  })

  it('does not render disc headers for single-disc album', async () => {
    const track = makeTrack({ discNumber: undefined })
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ tracks: [track] }))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('track-row-track-id-1')).toBeInTheDocument()
    })
    expect(screen.queryByText(/^Disc /)).not.toBeInTheDocument()
  })

  it('renders Position column header', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ tracks: [makeTrack()] }))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByRole('columnheader', { name: 'Position' })).toBeInTheDocument()
    })
  })

  // ──────────────────────────────────────────────
  // Path display (#578)
  // ──────────────────────────────────────────────

  it('renders album path as read-only text', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ albumPath: 'Jazz/Miles Davis/Kind of Blue' }))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('album-path')).toBeInTheDocument()
    })
    expect(screen.getByTestId('album-path')).toHaveTextContent('Jazz/Miles Davis/Kind of Blue')
  })

  it('renders Copy button for album path', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ albumPath: 'Jazz/Miles Davis/Kind of Blue' }))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('album-path-copy')).toBeInTheDocument()
    })
    const copyBtn = screen.getByTestId('album-path-copy')
    expect(copyBtn).toHaveAttribute('aria-label')
  })

  it('renders track filePath in each track row', async () => {
    const track = makeTrack({ id: 'track-id-1', filePath: '01 So What.flac' })
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ tracks: [track] }))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('track-track-id-1-file-path')).toBeInTheDocument()
    })
    expect(screen.getByTestId('track-track-id-1-file-path')).toHaveTextContent('01 So What.flac')
  })

  it('renders Copy button for track filePath', async () => {
    const track = makeTrack({ id: 'track-id-1', filePath: '01 So What.flac' })
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ tracks: [track] }))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('track-track-id-1-file-path-copy')).toBeInTheDocument()
    })
    const copyBtn = screen.getByTestId('track-track-id-1-file-path-copy')
    expect(copyBtn).toHaveAttribute('aria-label')
  })

  it('renders File column header in tracks table', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ tracks: [makeTrack()] }))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByRole('columnheader', { name: 'File' })).toBeInTheDocument()
    })
  })

  it('renders paths with special chars and spaces correctly', async () => {
    const path = "Jazz & Blues (Miles Davis's)/Kind of Blue"
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ albumPath: path }))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('album-path')).toBeInTheDocument()
    })
    expect(screen.getByTestId('album-path')).toHaveTextContent(path)
  })

  // ──────────────────────────────────────────────
  // Two-column layout (#579)
  // ──────────────────────────────────────────────

  it('renders two-column layout container with metadata and tracklist columns', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('two-column-layout')).toBeInTheDocument()
    })
    expect(screen.getByTestId('metadata-column')).toBeInTheDocument()
    expect(screen.getByTestId('tracklist-column')).toBeInTheDocument()
  })

  it('places album tags section inside the metadata column', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('album-value-album')).toBeInTheDocument()
    })
    const metadataCol = screen.getByTestId('metadata-column')
    expect(metadataCol).toContainElement(screen.getByTestId('album-value-album'))
  })

  it('places tracks section inside the tracklist column', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('track-row-track-id-1')).toBeInTheDocument()
    })
    const tracklistCol = screen.getByTestId('tracklist-column')
    expect(tracklistCol).toContainElement(screen.getByTestId('track-row-track-id-1'))
  })

  it('back button is outside the two-column layout so it stays above both columns', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('back-button')).toBeInTheDocument()
    })
    const layout = screen.getByTestId('two-column-layout')
    // back button must NOT be inside the layout grid
    expect(layout).not.toContainElement(screen.getByTestId('back-button'))
  })

  it('SyncPanel is placed inside the metadata column when discogsId is set', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum({ discogsId: '42' }))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('sync-panel')).toBeInTheDocument()
    })
    const metadataCol = screen.getByTestId('metadata-column')
    expect(metadataCol).toContainElement(screen.getByTestId('sync-panel'))
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
      expect(screen.getByTestId('album-value-album')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('back-button'))

    // Nav guard must not appear
    expect(screen.queryByTestId('nav-guard-dialog')).not.toBeInTheDocument()
    // Should have navigated to list page
    await waitFor(() => {
      expect(screen.getByTestId('list-page')).toBeInTheDocument()
    })
  })

  it('shows nav guard dialog when there are dirty fields and Back is clicked', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()

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

    // Still on album detail page
    expect(screen.getByTestId('album-value-album')).toBeInTheDocument()
    // Dirty count must still be visible (changes preserved)
    expect(screen.getByTestId('dirty-count')).toBeInTheDocument()
  })

  it('does not show nav guard after batch save clears dirty fields', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    mockAlbumsService.updateAlbumTags.mockResolvedValue(makeAlbum({ album: 'New Title' }))
    renderDetail()

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

    // Now clicking Back should NOT trigger the nav guard
    fireEvent.click(screen.getByTestId('back-button'))
    expect(screen.queryByTestId('nav-guard-dialog')).not.toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByTestId('list-page')).toBeInTheDocument()
    })
  })

  it('pressing Escape on nav guard dialog keeps user on album detail page with dirty changes intact', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()

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
