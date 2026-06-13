import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
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
        onClick={() => onSyncComplete({ id: 'album-id-1', albumArtist: 'Updated Artist', album: 'Updated Album', directoryPath: '/music', hasCoverArt: false })}
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
    directoryPath: 'Jazz/Miles Davis/Kind of Blue',
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

function renderDetail(albumId = 'album-id-1') {
  const queryClient = makeQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/albums/${albumId}`]}>
        <Routes>
          <Route path="/albums/:albumId" element={<AlbumDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** Helper: open edit mode for a field, type a new value, press Enter, then confirm in dialog. */
async function editAlbumFieldAndConfirm(fieldTestId: string, inputTestId: string, newValue: string) {
  fireEvent.click(screen.getByTestId(fieldTestId))
  fireEvent.change(screen.getByTestId(inputTestId), { target: { value: newValue } })
  fireEvent.keyDown(screen.getByTestId(inputTestId), { key: 'Enter' })

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

  it('rolls back and shows error when updateAlbumTags fails after confirmation', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    mockAlbumsService.updateAlbumTags.mockRejectedValue(new Error('Server error'))
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('album-value-genre')).toBeInTheDocument()
    })

    await editAlbumFieldAndConfirm('album-value-genre', 'album-input-genre', 'Rock')

    await waitFor(() => {
      expect(screen.queryByTestId('album-input-genre')).not.toBeInTheDocument()
      expect(screen.getByTestId('album-value-genre')).toHaveTextContent('Jazz')
      expect(screen.getByTestId('album-error-genre')).toHaveTextContent('Server error')
    })
  })

  // ──────────────────────────────────────────────
  // Confirmation dialog behaviour
  // ──────────────────────────────────────────────

  it('shows confirmation dialog before the PATCH fires', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    mockAlbumsService.updateAlbumTags.mockResolvedValue(makeAlbum({ genre: 'Rock' }))
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('album-value-genre')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('album-value-genre'))
    fireEvent.change(screen.getByTestId('album-input-genre'), { target: { value: 'Rock' } })
    fireEvent.keyDown(screen.getByTestId('album-input-genre'), { key: 'Enter' })

    // Dialog appears; PATCH has NOT been called yet
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

    fireEvent.click(screen.getByTestId('album-value-genre'))
    fireEvent.change(screen.getByTestId('album-input-genre'), { target: { value: 'Rock' } })
    fireEvent.keyDown(screen.getByTestId('album-input-genre'), { key: 'Enter' })

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

    fireEvent.click(screen.getByTestId('album-value-genre'))
    fireEvent.change(screen.getByTestId('album-input-genre'), { target: { value: 'Rock' } })
    fireEvent.keyDown(screen.getByTestId('album-input-genre'), { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog-warning')).toHaveTextContent('This cannot be undone')
    })
  })

  it('Cancel button prevents the PATCH and leaves field in edited state', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('album-value-genre')).toBeInTheDocument()
    })

    // Edit and trigger dialog
    fireEvent.click(screen.getByTestId('album-value-genre'))
    fireEvent.change(screen.getByTestId('album-input-genre'), { target: { value: 'Rock' } })
    fireEvent.keyDown(screen.getByTestId('album-input-genre'), { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    })

    // Cancel
    fireEvent.click(screen.getByTestId('confirm-dialog-cancel'))

    await waitFor(() => {
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
    })

    // PATCH was never called
    expect(mockAlbumsService.updateAlbumTags).not.toHaveBeenCalled()
    // Field shows original value (rolled back silently - no error shown)
    expect(screen.getByTestId('album-value-genre')).toHaveTextContent('Jazz')
    expect(screen.queryByTestId('album-error-genre')).not.toBeInTheDocument()
  })

  it('Escape on the dialog cancels without firing the PATCH', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('album-value-genre')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('album-value-genre'))
    fireEvent.change(screen.getByTestId('album-input-genre'), { target: { value: 'Rock' } })
    fireEvent.keyDown(screen.getByTestId('album-input-genre'), { key: 'Enter' })

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
})
