import { render, screen, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppThemeProvider } from './theme'
import { AlbumListPage } from './App'
import type { Album, AlbumPage } from './api/generated'
import { CLIENT_SIDE_THRESHOLD } from './features/albums/album-list-mode'

// Mock the generated client so BOTH the first-page probe (useAllAlbums) and the
// per-page server query (useAlbumPage) run for real against a controllable
// backend. This exercises the genuine dual-mode hooks end-to-end through the
// page, proving the server-side path (NFR-12) and no truncation (NFR-11).
vi.mock('./api/generated', () => ({
  AlbumsService: { listAlbums: vi.fn() },
}))

import { AlbumsService } from './api/generated'
const mockListAlbums = vi.mocked(AlbumsService.listAlbums)

const LIBRARY_SIZE = 10000 // > CLIENT_SIDE_THRESHOLD: forces server-side mode (NFR-11).

function makeAlbum(globalIndex: number): Album {
  return {
    id: `album-${globalIndex}`,
    albumArtist: `Artist ${String(globalIndex).padStart(5, '0')}`,
    album: `Album ${String(globalIndex).padStart(5, '0')}`,
    hasCoverArt: false,
    albumPath: `/music/album-${globalIndex}`,
  }
}

/**
 * A fake server over a `LIBRARY_SIZE`-album library. Honours page/size and a
 * single albumArtist "contains" filter + free-text q so the tests can assert
 * the params actually drive the returned page.
 */
function fakeServer(query: {
  page?: number
  size?: number
  albumArtist?: string
  q?: string
  genre?: string
  composer?: string
}): Promise<AlbumPage> {
  const size = query.size ?? 20
  const page = query.page ?? 0
  const all = Array.from({ length: LIBRARY_SIZE }, (_, i) => makeAlbum(i))
  const filtered = all.filter((a) => {
    if (query.albumArtist && !a.albumArtist.toLowerCase().includes(query.albumArtist.toLowerCase())) return false
    if (query.q && !`${a.album} ${a.albumArtist}`.toLowerCase().includes(query.q.toLowerCase())) return false
    return true
  })
  const start = page * size
  const content = filtered.slice(start, start + size)
  return Promise.resolve({
    content,
    page,
    size,
    totalElements: filtered.length,
    totalPages: Math.max(1, Math.ceil(filtered.length / size)),
  })
}

function renderApp(initialEntries: string[] = ['/']) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      { index: true, element: <AlbumListPage /> },
      { path: '/albums/:albumId', element: <div data-testid="album-detail-route">detail</div> },
    ],
    { initialEntries },
  )
  const utils = render(
    <AppThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AppThemeProvider>,
  )
  return { ...utils, router }
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  sessionStorage.clear()
  mockListAlbums.mockImplementation((q) => fakeServer(q) as ReturnType<typeof AlbumsService.listAlbums>)
})

describe('AlbumListPage - server-side mode (NFR-11 / NFR-12)', () => {
  it('uses server-side mode above the threshold and renders only one page (no full load)', async () => {
    renderApp()

    // The first page of 48 cards from the server is rendered.
    expect(await screen.findByTitle('Album 00000')).toBeInTheDocument()
    expect(screen.getAllByTestId('album-card')).toHaveLength(48)
    // Total reflects the FULL 10 000-album library - it is NOT truncated to
    // 5 000 (the old MAX_PAGES cap). This is the core NFR-11 assertion.
    const status = screen.getByTestId('album-grid-result-count')
    expect(status).toHaveTextContent('Showing 48 of 10000 albums')
    // Pager spans the whole library: ceil(10000 / 48) = 209 pages.
    expect(screen.getByTestId('pagination-info')).toHaveTextContent('Page 1 of 209')

    // Only the probe (page 0) and the page-0 server query ran - no walk of all
    // pages. Both call page 0, so at most 2 distinct fetches, never ~100.
    expect(mockListAlbums.mock.calls.length).toBeLessThanOrEqual(2)
  })

  it('hides the full-set sort + filter panel in server mode (documented limitation)', async () => {
    renderApp()
    await screen.findByTitle('Album 00000')
    expect(screen.queryByRole('combobox', { name: 'Sort by' })).not.toBeInTheDocument()
    expect(screen.queryByRole('complementary', { name: 'Filter albums' })).not.toBeInTheDocument()
  })

  it('navigating to page 2 fetches and renders ONLY that server page', async () => {
    const user = userEvent.setup()
    const { router } = renderApp()
    await screen.findByTitle('Album 00000')

    await user.click(screen.getByRole('button', { name: 'Go to page 2' }))

    // Page 2 = server page index 1 = albums 48..95.
    expect(await screen.findByTitle('Album 00048')).toBeInTheDocument()
    expect(screen.queryByTitle('Album 00000')).not.toBeInTheDocument()
    expect(screen.getByTestId('pagination-info')).toHaveTextContent('Page 2 of 209')
    expect(router.state.location.search).toContain('page=2')
    // The server was asked for page index 1 with size 48.
    expect(mockListAlbums).toHaveBeenCalledWith(expect.objectContaining({ page: 1, size: 48 }))
    // Still only one page worth of cards in the DOM.
    expect(screen.getAllByTestId('album-card')).toHaveLength(48)
  })

  it('deep-links to a server page via the URL and renders that page only', async () => {
    renderApp(['/?page=3'])
    // Page 3 = server index 2 = albums 96..143.
    expect(await screen.findByTitle('Album 00096')).toBeInTheDocument()
    expect(screen.getByTestId('pagination-info')).toHaveTextContent('Page 3 of 209')
    expect(mockListAlbums).toHaveBeenCalledWith(expect.objectContaining({ page: 2, size: 48 }))
  })

  it('typing a search maps to the server q param and resets to page 1', async () => {
    const user = userEvent.setup({ delay: null })
    const { router } = renderApp(['/?page=5'])
    await screen.findByTitle('Album 00192')
    expect(screen.getByTestId('pagination-info')).toHaveTextContent('Page 5 of 209')

    // "Album 01234" matches exactly one record in the fake library.
    await user.type(screen.getByRole('searchbox'), 'Album 01234')

    await act(async () => {
      await Promise.resolve()
    })

    expect(await screen.findByTitle('Album 01234')).toBeInTheDocument()
    expect(screen.getAllByTestId('album-card')).toHaveLength(1)
    // q sent to the server; page reset to 1 (page param dropped).
    expect(mockListAlbums).toHaveBeenCalledWith(expect.objectContaining({ q: 'Album 01234', page: 0 }))
    expect(router.state.location.search).not.toContain('page=5')
    // Single result -> one page -> no pager.
    expect(screen.queryByTestId('album-pagination')).not.toBeInTheDocument()
  })

  it('reads beyond the old 5 000 cap: a high page renders albums past index 5000', async () => {
    // Page 120 (size 48) starts at index 120*48=5712, well beyond the old
    // 5 000-album silent ceiling. This is the regression guard for NFR-11.
    renderApp(['/?page=120'])
    expect(await screen.findByTitle('Album 05712')).toBeInTheDocument()
    expect(screen.getByTestId('pagination-info')).toHaveTextContent('Page 120 of 209')
  })

  it('clamps an over-range server deep link so the rendered page matches the pager', async () => {
    // ?page=9999 is well past the 209-page library. The data hook must request
    // the clamped last page (208 zero-based), not an empty over-range page.
    renderApp(['/?page=9999'])
    // Last page (209) starts at index 208*48 = 9984.
    expect(await screen.findByTitle('Album 09984')).toBeInTheDocument()
    expect(screen.getByTestId('pagination-info')).toHaveTextContent('Page 209 of 209')
    expect(mockListAlbums).toHaveBeenCalledWith(expect.objectContaining({ page: 208, size: 48 }))
  })

  it('pagination nav is keyboard reachable and labelled in server mode (a11y)', async () => {
    renderApp()
    await screen.findByTitle('Album 00000')
    const nav = screen.getByRole('navigation', { name: 'Album page navigation' })
    expect(within(nav).getByRole('button', { name: 'Go to page 2' })).toBeInTheDocument()
  })
})

describe('AlbumListPage - mode-detection boundary', () => {
  it('uses client-side mode at exactly the threshold (full set loaded, sort shown)', async () => {
    // At the threshold the probe reports <= threshold, so the client loader runs
    // and walks all pages. Keep the fake library small for this test.
    const atThreshold = CLIENT_SIDE_THRESHOLD
    const albums = Array.from({ length: 3 }, (_, i) => makeAlbum(i))
    mockListAlbums.mockReset()
    mockListAlbums.mockResolvedValue({
      content: albums,
      page: 0,
      size: 100,
      totalElements: atThreshold,
      totalPages: 1,
    } as AlbumPage)

    renderApp()
    // All three albums render (full set loaded => client mode at the boundary).
    expect(await screen.findAllByTestId('album-card')).toHaveLength(3)
    // Sort control is present (client mode), proving the boundary stays client.
    expect(screen.getByRole('combobox', { name: 'Sort by' })).toBeInTheDocument()
  })

  it('switches to server-side mode one album above the threshold (sort hidden)', async () => {
    const overThreshold = CLIENT_SIDE_THRESHOLD + 1
    mockListAlbums.mockReset()
    mockListAlbums.mockImplementation((q) =>
      Promise.resolve({
        content: [makeAlbum(q.page ?? 0)],
        page: q.page ?? 0,
        size: q.size ?? 20,
        totalElements: overThreshold,
        totalPages: Math.ceil(overThreshold / (q.size ?? 20)),
      } as AlbumPage) as ReturnType<typeof AlbumsService.listAlbums>,
    )

    renderApp()
    expect(await screen.findByTestId('album-grid-result-count')).toHaveTextContent(
      `of ${String(overThreshold)} albums`,
    )
    expect(screen.queryByRole('combobox', { name: 'Sort by' })).not.toBeInTheDocument()
  })
})
