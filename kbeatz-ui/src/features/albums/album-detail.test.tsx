import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AlbumDetail } from './album-detail'
import type { AlbumDetail as AlbumDetailModel, Track } from '../../api/generated'

// Mock the AlbumsService
vi.mock('../../api/generated', () => ({
  AlbumsService: {
    getAlbum: vi.fn(),
    updateAlbumTags: vi.fn(),
    updateTrackTags: vi.fn(),
  },
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
    directoryPath: '/music/kind-of-blue',
    hasCoverArt: false,
    tracks: [makeTrack()],
    ...overrides,
  }
}

function renderDetail(albumId = 'album-id-1') {
  return render(
    <MemoryRouter initialEntries={[`/albums/${albumId}`]}>
      <Routes>
        <Route path="/albums/:albumId" element={<AlbumDetail />} />
      </Routes>
    </MemoryRouter>,
  )
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

  it('calls updateAlbumTags and updates album on Enter save', async () => {
    const updatedAlbum = makeAlbum({ genre: 'Progressive Rock' })
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    mockAlbumsService.updateAlbumTags.mockResolvedValue(updatedAlbum)
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('album-value-genre')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('album-value-genre'))
    fireEvent.change(screen.getByTestId('album-input-genre'), {
      target: { value: 'Progressive Rock' },
    })
    fireEvent.keyDown(screen.getByTestId('album-input-genre'), { key: 'Enter' })

    await waitFor(() => {
      expect(mockAlbumsService.updateAlbumTags).toHaveBeenCalledWith({
        albumId: 'album-id-1',
        requestBody: { field: 'GENRE', value: 'Progressive Rock' },
      })
    })
  })

  it('Escape cancels edit and makes no API call', async () => {
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
    expect(mockAlbumsService.updateAlbumTags).not.toHaveBeenCalled()
  })

  it('rolls back and shows error when updateAlbumTags fails', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
    mockAlbumsService.updateAlbumTags.mockRejectedValue(new Error('Server error'))
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('album-value-genre')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('album-value-genre'))
    fireEvent.change(screen.getByTestId('album-input-genre'), { target: { value: 'Rock' } })
    fireEvent.keyDown(screen.getByTestId('album-input-genre'), { key: 'Enter' })

    await waitFor(() => {
      expect(screen.queryByTestId('album-input-genre')).not.toBeInTheDocument()
      expect(screen.getByTestId('album-value-genre')).toHaveTextContent('Jazz')
      expect(screen.getByTestId('album-error-genre')).toHaveTextContent('Server error')
    })
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
})
