import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

describe('SyncPanel', () => {
  const onSyncComplete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ---- visibility ----

  it('should not render when album has no discogsId', () => {
    const album = buildAlbum({ discogsId: undefined })
    const { container } = render(<SyncPanel album={album} onSyncComplete={onSyncComplete} />)
    expect(container.firstChild).toBeNull()
  })

  it('should render sync panel when album has a discogsId', () => {
    const album = buildAlbum()
    render(<SyncPanel album={album} onSyncComplete={onSyncComplete} />)
    expect(screen.getByTestId('sync-button')).toBeInTheDocument()
    expect(screen.getByTestId('discogs-id')).toHaveTextContent('12345')
  })

  // ---- default checkbox state ----

  it('should show "Also update cover art" checkbox unchecked by default', () => {
    const album = buildAlbum()
    render(<SyncPanel album={album} onSyncComplete={onSyncComplete} />)
    const checkbox = screen.getByTestId('download-images-checkbox')
    expect(checkbox).not.toBeChecked()
  })

  // ---- loading state ----

  it('should show loading indicator and disable button during sync', async () => {
    const album = buildAlbum()
    let resolve: (v: Album) => void = () => {}
    mockSyncAlbum.mockReturnValue(new Promise((r) => { resolve = r }) as ReturnType<typeof mockSyncAlbum>)

    render(<SyncPanel album={album} onSyncComplete={onSyncComplete} />)
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

    render(<SyncPanel album={album} onSyncComplete={onSyncComplete} />)
    await userEvent.click(screen.getByTestId('sync-button'))

    await waitFor(() => expect(screen.getByTestId('sync-success')).toBeInTheDocument())
    expect(onSyncComplete).toHaveBeenCalledWith(updatedAlbum)
  })

  // ---- error state ----

  it('should show error message on sync failure', async () => {
    const album = buildAlbum()
    mockSyncAlbum.mockRejectedValue({
      body: { code: 'SYNC_FAILED', message: 'Discogs API unavailable. Please try again later.' },
    })

    render(<SyncPanel album={album} onSyncComplete={onSyncComplete} />)
    await userEvent.click(screen.getByTestId('sync-button'))

    await waitFor(() => expect(screen.getByTestId('sync-error')).toBeInTheDocument())
    expect(screen.getByTestId('sync-error')).toHaveTextContent('Discogs API unavailable')
  })

  it('should show 404 error message when album not found in Discogs', async () => {
    const album = buildAlbum()
    mockSyncAlbum.mockRejectedValue({
      body: { code: 'RESOURCE_NOT_FOUND', message: 'Discogs release 12345 not found' },
    })

    render(<SyncPanel album={album} onSyncComplete={onSyncComplete} />)
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
    render(<SyncPanel album={album} onSyncComplete={onSyncComplete} />)

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

    render(<SyncPanel album={album} onSyncComplete={onSyncComplete} />)
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

    render(<SyncPanel album={album} onSyncComplete={onSyncComplete} />)
    await userEvent.click(screen.getByTestId('sync-button'))

    await waitFor(() => expect(mockSyncAlbum).toHaveBeenCalledWith({
      albumId: 'test-album-id',
      requestBody: { downloadImages: false },
    }))
  })
})
