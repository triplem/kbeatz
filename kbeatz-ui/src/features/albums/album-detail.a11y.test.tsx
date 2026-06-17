import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppThemeProvider } from '../../theme'
import { AlbumDetail } from './album-detail'
import type { AlbumDetail as AlbumDetailModel, Track } from '../../api/generated'
import { assertNoA11yViolations } from '../../test/a11y'
import { THEME_STORAGE_KEY } from '../../theme/theme'

function applyTheme(theme: 'light' | 'dark'): void {
  window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  document.documentElement.setAttribute('data-mui-color-scheme', theme)
}

vi.mock('../../api/generated', () => ({
  AlbumsService: {
    getAlbum: vi.fn(),
    updateAlbumTags: vi.fn(),
    updateTrackTags: vi.fn(),
    bulkUpdateAlbumTags: vi.fn(),
    syncAlbumFromDiscogs: vi.fn(),
  },
}))

vi.mock('../sync/sync-panel', () => ({
  SyncPanel: () => <div data-testid="sync-panel" />,
}))

import { AlbumsService } from '../../api/generated'

const mockAlbumsService = AlbumsService as unknown as {
  getAlbum: ReturnType<typeof vi.fn>
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
    albumPath: 'Jazz/Miles Davis/Kind of Blue',
    hasCoverArt: false,
    tracks: [makeTrack(), makeTrack({ id: 'track-id-2', title: 'Freddie Freeloader', trackNumber: '2' })],
    ...overrides,
  }
}

function detailTree() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const router = createMemoryRouter(
    [
      { path: '/', element: <div>list</div> },
      { path: '/albums/:albumId', element: <AlbumDetail /> },
    ],
    { initialEntries: ['/', '/albums/album-id-1'], initialIndex: 1 },
  )
  return (
    <AppThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AppThemeProvider>
  )
}

describe('AlbumDetail accessibility', () => {
  beforeEach(() => {
    window.localStorage.clear()
    mockAlbumsService.getAlbum.mockResolvedValue(makeAlbum())
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('exposes the album as the single h1 page heading', async () => {
    applyTheme('light')
    render(detailTree())
    await screen.findByRole('heading', { level: 1, name: 'Kind of Blue' })
    expect(screen.getByRole('heading', { level: 1, name: 'Kind of Blue' })).toBeInTheDocument()
  })

  it('has no WCAG 2.1 AA violations in light theme', async () => {
    applyTheme('light')
    render(detailTree())
    await screen.findByRole('heading', { level: 1, name: 'Kind of Blue' })
    await assertNoA11yViolations()
  })

  it('has no WCAG 2.1 AA violations in dark theme', async () => {
    applyTheme('dark')
    render(detailTree())
    await screen.findByRole('heading', { level: 1, name: 'Kind of Blue' })
    await assertNoA11yViolations()
  })
})
