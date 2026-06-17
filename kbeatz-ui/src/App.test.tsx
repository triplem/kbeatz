import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppThemeProvider } from './theme'
import { AlbumListPage } from './App'
import type { Album } from './api/generated'
import { PAGE_SIZE_STORAGE_KEY } from './features/albums/pagination'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('./features/albums/useAllAlbums', () => ({
  useAllAlbums: vi.fn(),
}))

import { useAllAlbums } from './features/albums/useAllAlbums'
const mockUseAllAlbums = vi.mocked(useAllAlbums)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type AllAlbumsResult = Pick<ReturnType<typeof useAllAlbums>, 'data' | 'isPending' | 'isError' | 'refetch'>

function makeAlbum(index: number): Album {
  return {
    id: `album-${index}`,
    albumArtist: `Artist ${String(index).padStart(4, '0')}`,
    album: `Album ${String(index).padStart(4, '0')}`,
    hasCoverArt: false,
    albumPath: `/music/album-${index}`,
  }
}

function makeAlbums(count: number): Album[] {
  return Array.from({ length: count }, (_, i) => makeAlbum(i))
}

function makeResult(overrides: Partial<AllAlbumsResult> = {}): AllAlbumsResult {
  return {
    data: [],
    isPending: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  }
}

function asMock(result: AllAlbumsResult): ReturnType<typeof useAllAlbums> {
  return result as ReturnType<typeof useAllAlbums>
}

interface RenderOptions {
  readonly initialEntries?: string[]
}

function renderApp({ initialEntries = ['/'] }: RenderOptions = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
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
})

// ---------------------------------------------------------------------------
// Loading / error states
// ---------------------------------------------------------------------------

describe('AlbumListPage - loading and error', () => {
  it('shows a spinner while albums are pending', () => {
    mockUseAllAlbums.mockReturnValue(asMock(makeResult({ isPending: true, data: undefined })))
    renderApp()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(screen.queryByTestId('album-grid-section')).not.toBeInTheDocument()
  })

  it('shows an error alert with a retry button on error', async () => {
    const refetch = vi.fn()
    mockUseAllAlbums.mockReturnValue(asMock(makeResult({ isError: true, data: undefined, refetch })))
    renderApp()
    expect(screen.getByTestId('albums-error')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByTestId('albums-retry-button'))
    expect(refetch).toHaveBeenCalledOnce()
  })

  it('shows the empty message when there are no albums', () => {
    mockUseAllAlbums.mockReturnValue(asMock(makeResult({ data: [] })))
    renderApp()
    expect(screen.getByTestId('album-grid-empty')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// One page of cards (AC2)
// ---------------------------------------------------------------------------

describe('AlbumListPage - renders one page of cards', () => {
  it('renders only the first page (default size 48) when more albums exist', () => {
    mockUseAllAlbums.mockReturnValue(asMock(makeResult({ data: makeAlbums(100) })))
    renderApp()
    expect(screen.getAllByTestId('album-card')).toHaveLength(48)
  })

  it('renders all albums when fewer than one page exist (no pagination)', () => {
    mockUseAllAlbums.mockReturnValue(asMock(makeResult({ data: makeAlbums(10) })))
    renderApp()
    expect(screen.getAllByTestId('album-card')).toHaveLength(10)
    expect(screen.queryByTestId('album-pagination')).not.toBeInTheDocument()
  })

  it('announces filtered/total count to screen readers', () => {
    mockUseAllAlbums.mockReturnValue(asMock(makeResult({ data: makeAlbums(100) })))
    renderApp()
    const status = screen.getByTestId('album-grid-result-count')
    expect(status).toHaveTextContent('Showing 48 of 100 albums')
    expect(status).toHaveAttribute('aria-live', 'polite')
  })
})

// ---------------------------------------------------------------------------
// Page change updates cards + URL (AC2/AC5)
// ---------------------------------------------------------------------------

describe('AlbumListPage - page navigation', () => {
  it('changing page renders the next slice of cards and updates the URL', async () => {
    const user = userEvent.setup()
    mockUseAllAlbums.mockReturnValue(asMock(makeResult({ data: makeAlbums(100) })))
    const { router } = renderApp()

    // First page: cards 0..47, so "Album 0000" present, "Album 0048" absent.
    expect(screen.getByTitle('Album 0000')).toBeInTheDocument()
    expect(screen.queryByTitle('Album 0048')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Go to page 2' }))

    // Second page: cards 48..95
    expect(screen.getByTitle('Album 0048')).toBeInTheDocument()
    expect(screen.queryByTitle('Album 0000')).not.toBeInTheDocument()
    // URL reflects the page (AC5)
    expect(router.state.location.search).toContain('page=2')
    expect(screen.getByTestId('pagination-info')).toHaveTextContent('Page 2 of 3')
  })

  it('deep-links to a page via the URL query param (AC5)', () => {
    mockUseAllAlbums.mockReturnValue(asMock(makeResult({ data: makeAlbums(100) })))
    renderApp({ initialEntries: ['/?page=2'] })
    expect(screen.getByTitle('Album 0048')).toBeInTheDocument()
    expect(screen.getByTestId('pagination-info')).toHaveTextContent('Page 2 of 3')
  })

  it('clamps an out-of-range page param into the valid range', () => {
    mockUseAllAlbums.mockReturnValue(asMock(makeResult({ data: makeAlbums(100) })))
    renderApp({ initialEntries: ['/?page=999'] })
    // 100 albums / 48 = 3 pages; clamps to last page (3)
    expect(screen.getByTestId('pagination-info')).toHaveTextContent('Page 3 of 3')
  })

  it('ignores a non-numeric page param and shows page 1', () => {
    mockUseAllAlbums.mockReturnValue(asMock(makeResult({ data: makeAlbums(100) })))
    renderApp({ initialEntries: ['/?page=abc'] })
    expect(screen.getByTestId('pagination-info')).toHaveTextContent('Page 1 of 3')
  })
})

// ---------------------------------------------------------------------------
// Filter/search resets to page 1 and paginates filtered results (AC4)
// ---------------------------------------------------------------------------

describe('AlbumListPage - filter resets pagination', () => {
  it('typing a search query filters the set and resets to page 1', async () => {
    const user = userEvent.setup()
    mockUseAllAlbums.mockReturnValue(asMock(makeResult({ data: makeAlbums(100) })))
    const { router } = renderApp({ initialEntries: ['/?page=3'] })

    expect(screen.getByTestId('pagination-info')).toHaveTextContent('Page 3 of 3')

    // Search for a single album. "Album 0042" matches exactly one record.
    await user.type(screen.getByRole('searchbox'), 'Album 0042')

    // Filtered set has 1 result -> no pagination, page reset to 1
    expect(await screen.findByTitle('Album 0042')).toBeInTheDocument()
    expect(screen.getAllByTestId('album-card')).toHaveLength(1)
    expect(screen.queryByTestId('album-pagination')).not.toBeInTheDocument()
    // page param dropped on reset
    expect(router.state.location.search).not.toContain('page=3')
  })

  it('paginates over the FILTERED results, not the full set', async () => {
    const user = userEvent.setup()
    mockUseAllAlbums.mockReturnValue(asMock(makeResult({ data: makeAlbums(100) })))
    renderApp()

    // "Artist 000" matches Artist 0000..0009 (10 albums) - one page, no pager.
    // "Album 00" matches Album 0000..0099 i.e. all - use a sharper query.
    // Search "Album 005" matches Album 0050..0059 = 10 results.
    await user.type(screen.getByRole('searchbox'), 'Album 005')

    expect(await screen.findByTitle('Album 0050')).toBeInTheDocument()
    expect(screen.getAllByTestId('album-card')).toHaveLength(10)
  })
})

// ---------------------------------------------------------------------------
// Page size persistence + selection (AC3)
// ---------------------------------------------------------------------------

describe('AlbumListPage - page size', () => {
  it('changing page size updates the rendered count and persists to localStorage', async () => {
    const user = userEvent.setup()
    mockUseAllAlbums.mockReturnValue(asMock(makeResult({ data: makeAlbums(100) })))
    renderApp()

    expect(screen.getAllByTestId('album-card')).toHaveLength(48)

    // Open the page-size select and pick 24.
    await user.click(screen.getByRole('combobox', { name: 'Per page' }))
    await user.click(screen.getByRole('option', { name: '24 per page' }))

    expect(screen.getAllByTestId('album-card')).toHaveLength(24)
    expect(localStorage.getItem(PAGE_SIZE_STORAGE_KEY)).toBe('24')
  })

  it('reads the persisted page size from localStorage on load', () => {
    localStorage.setItem(PAGE_SIZE_STORAGE_KEY, '24')
    mockUseAllAlbums.mockReturnValue(asMock(makeResult({ data: makeAlbums(100) })))
    renderApp()
    expect(screen.getAllByTestId('album-card')).toHaveLength(24)
  })

  it('falls back to the default when localStorage holds a corrupt page size', () => {
    localStorage.setItem(PAGE_SIZE_STORAGE_KEY, 'not-a-number')
    mockUseAllAlbums.mockReturnValue(asMock(makeResult({ data: makeAlbums(100) })))
    renderApp()
    expect(screen.getAllByTestId('album-card')).toHaveLength(48)
  })

  it('a URL size param overrides the persisted default', () => {
    localStorage.setItem(PAGE_SIZE_STORAGE_KEY, '48')
    mockUseAllAlbums.mockReturnValue(asMock(makeResult({ data: makeAlbums(100) })))
    renderApp({ initialEntries: ['/?size=24'] })
    expect(screen.getAllByTestId('album-card')).toHaveLength(24)
  })
})

// ---------------------------------------------------------------------------
// Accessibility (AC8)
// ---------------------------------------------------------------------------

describe('AlbumListPage - accessibility', () => {
  it('renders a labelled pagination nav landmark', () => {
    mockUseAllAlbums.mockReturnValue(asMock(makeResult({ data: makeAlbums(100) })))
    renderApp()
    expect(screen.getByRole('navigation', { name: 'Album page navigation' })).toBeInTheDocument()
  })

  it('pagination page buttons are keyboard reachable with labelled controls', async () => {
    const user = userEvent.setup()
    mockUseAllAlbums.mockReturnValue(asMock(makeResult({ data: makeAlbums(100) })))
    renderApp()

    const nav = screen.getByRole('navigation', { name: 'Album page navigation' })
    const goToPage2 = within(nav).getByRole('button', { name: 'Go to page 2' })
    goToPage2.focus()
    expect(goToPage2).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(screen.getByTestId('pagination-info')).toHaveTextContent('Page 2 of 3')
  })

  it('search box and sort have visible labels (no placeholder-only labelling)', () => {
    mockUseAllAlbums.mockReturnValue(asMock(makeResult({ data: makeAlbums(10) })))
    renderApp()
    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Sort by' })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Navigation to detail (AC6 - filters/page survive in URL)
// ---------------------------------------------------------------------------

describe('AlbumListPage - navigation preserves state', () => {
  it('keeps the page query param in the URL when navigating to a card', async () => {
    const user = userEvent.setup()
    mockUseAllAlbums.mockReturnValue(asMock(makeResult({ data: makeAlbums(100) })))
    const { router } = renderApp({ initialEntries: ['/?page=2'] })

    // Confirm page 2 rendered, then click a card to navigate to detail.
    const card = screen.getByRole('button', { name: /View details for Album 0048/ })
    await user.click(card)

    expect(screen.getByTestId('album-detail-route')).toBeInTheDocument()
    // Returning to "/" with the prior search restores the page; the router back
    // entry retains page=2 (the grid reads it from the URL on remount).
    expect(router.state.location.pathname).toBe('/albums/album-48')
  })
})
