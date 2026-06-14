import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App } from './App'
import type { AlbumPage } from './api/generated'
import { EMPTY_FILTERS } from './features/albums/album-filters'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('./features/albums/use-album-page', () => ({
  useAlbumPage: vi.fn(),
}))

// Mock useAlbumFilters to return a stable object so the page-reset useEffect
// does not fire on every render (filters is created with filtersFromParams
// which returns a new object reference each render, causing constant page resets).
vi.mock('./features/albums/useAlbumFilters', () => ({
  useAlbumFilters: vi.fn(() => ({
    filters: EMPTY_FILTERS,
    setFilters: vi.fn(),
    clearFilters: vi.fn(),
  })),
}))

vi.mock('./api/generated', () => ({
  LibraryService: {
    getLibraryScanStatus: vi.fn().mockResolvedValue({ state: 'IDLE' }),
    triggerLibraryScan: vi.fn().mockResolvedValue(undefined),
  },
  AlbumsService: {
    listAlbums: vi.fn().mockResolvedValue({
      content: [],
      page: 0,
      size: 20,
      totalElements: 0,
      totalPages: 0,
    }),
  },
}))

import { useAlbumPage } from './features/albums/use-album-page'
const mockUseAlbumPage = vi.mocked(useAlbumPage)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePageResult(overrides: Partial<AlbumPage> = {}): ReturnType<typeof useAlbumPage> {
  const page: AlbumPage = {
    content: [],
    page: 0,
    size: 20,
    totalElements: 0,
    totalPages: 0,
    ...overrides,
  }
  return {
    data: page,
    isPending: false,
    isError: false,
    isSuccess: true,
    error: null,
    refetch: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AlbumListPage - pagination visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not render pagination when totalPages is 0', () => {
    mockUseAlbumPage.mockReturnValue(makePageResult({ totalPages: 0 }))
    renderApp()
    expect(screen.queryByTestId('album-pagination')).not.toBeInTheDocument()
  })

  it('does not render pagination when totalPages is 1', () => {
    mockUseAlbumPage.mockReturnValue(makePageResult({ totalPages: 1, totalElements: 1 }))
    renderApp()
    expect(screen.queryByTestId('album-pagination')).not.toBeInTheDocument()
  })

  it('renders pagination nav landmark when totalPages > 1', () => {
    mockUseAlbumPage.mockReturnValue(makePageResult({ totalPages: 3, totalElements: 60, page: 0 }))
    renderApp()
    expect(screen.getByRole('navigation', { name: 'Album page navigation' })).toBeInTheDocument()
  })

  it('hides prev button and shows next button on first page (page 0 of 3)', () => {
    mockUseAlbumPage.mockReturnValue(makePageResult({ totalPages: 3, totalElements: 60, page: 0 }))
    renderApp()
    // On page 0, prev should be hidden and next should be visible
    expect(screen.queryByTestId('pagination-prev')).not.toBeInTheDocument()
    expect(screen.getByTestId('pagination-next')).toBeInTheDocument()
  })

  it('shows both prev and next buttons on a middle page', async () => {
    const user = userEvent.setup()
    // Start on page 0 of 3
    mockUseAlbumPage.mockReturnValue(makePageResult({ totalPages: 3, totalElements: 60, page: 0 }))
    renderApp()

    // Click next to advance to page 1 (middle page)
    await user.click(screen.getByTestId('pagination-next'))

    // On page 1 of 3 (middle), both buttons should be present
    expect(screen.getByTestId('pagination-prev')).toBeInTheDocument()
    expect(screen.getByTestId('pagination-next')).toBeInTheDocument()
  })

  it('hides next button and shows prev button on last page', async () => {
    const user = userEvent.setup()
    // Start on page 0 of 2 so one next click lands on the last page
    mockUseAlbumPage.mockReturnValue(makePageResult({ totalPages: 2, totalElements: 40, page: 0 }))
    renderApp()

    // Click next to advance to page 1 (last page of 2)
    await user.click(screen.getByTestId('pagination-next'))

    expect(screen.getByTestId('pagination-prev')).toBeInTheDocument()
    expect(screen.queryByTestId('pagination-next')).not.toBeInTheDocument()
  })

  it('shows page info text in the aria-live span', () => {
    mockUseAlbumPage.mockReturnValue(makePageResult({ totalPages: 3, totalElements: 60, page: 0 }))
    renderApp()
    const info = screen.getByTestId('pagination-info')
    expect(info).toHaveTextContent('Page 1 of 3')
    expect(info).toHaveAttribute('aria-live', 'polite')
    expect(info).toHaveAttribute('aria-atomic', 'true')
  })
})

describe('AlbumListPage - focus management after pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('moves focus to the info span after clicking Next on a 2-page result (Next disappears)', async () => {
    const user = userEvent.setup()
    // 2 pages: clicking Next lands on the last page; Next button is removed
    mockUseAlbumPage.mockReturnValue(makePageResult({ totalPages: 2, totalElements: 40, page: 0 }))
    renderApp()

    await user.click(screen.getByTestId('pagination-next'))

    // The Next button must be gone
    expect(screen.queryByTestId('pagination-next')).not.toBeInTheDocument()
    // Focus should be on the info span, not lost to <body>
    expect(screen.getByTestId('pagination-info')).toHaveFocus()
  })

  it('moves focus to the info span after clicking Prev on the first page (Prev disappears)', async () => {
    const user = userEvent.setup()
    mockUseAlbumPage.mockReturnValue(makePageResult({ totalPages: 2, totalElements: 40, page: 0 }))
    renderApp()

    // Go to page 1 first
    await user.click(screen.getByTestId('pagination-next'))
    // Now go back to page 0 - Prev disappears
    await user.click(screen.getByTestId('pagination-prev'))

    expect(screen.queryByTestId('pagination-prev')).not.toBeInTheDocument()
    expect(screen.getByTestId('pagination-info')).toHaveFocus()
  })

  it('pagination-info span has tabIndex=-1 so it is focusable but not in Tab order', () => {
    mockUseAlbumPage.mockReturnValue(makePageResult({ totalPages: 3, totalElements: 60, page: 0 }))
    renderApp()
    expect(screen.getByTestId('pagination-info')).toHaveAttribute('tabindex', '-1')
  })
})

describe('AlbumListPage - next page navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('clicking Next advances the page counter and calls useAlbumPage with page 1', async () => {
    const user = userEvent.setup()
    mockUseAlbumPage.mockReturnValue(makePageResult({ totalPages: 3, totalElements: 60, page: 0 }))
    renderApp()

    expect(screen.getByTestId('pagination-info')).toHaveTextContent('Page 1 of 3')
    expect(screen.queryByTestId('pagination-prev')).not.toBeInTheDocument()

    await user.click(screen.getByTestId('pagination-next'))

    // Page counter must advance to 2
    expect(screen.getByTestId('pagination-info')).toHaveTextContent('Page 2 of 3')
    // Previous button must appear now that we left page 1
    expect(screen.getByTestId('pagination-prev')).toBeInTheDocument()
    // useAlbumPage must have been called with page index 1
    expect(mockUseAlbumPage).toHaveBeenCalledWith(1, expect.anything())
  })

  it('clicking Prev decrements the page counter', async () => {
    const user = userEvent.setup()
    mockUseAlbumPage.mockReturnValue(makePageResult({ totalPages: 3, totalElements: 60, page: 0 }))
    renderApp()

    // Navigate to page 1 first
    await user.click(screen.getByTestId('pagination-next'))
    expect(screen.getByTestId('pagination-info')).toHaveTextContent('Page 2 of 3')

    // Now go back
    await user.click(screen.getByTestId('pagination-prev'))
    expect(screen.getByTestId('pagination-info')).toHaveTextContent('Page 1 of 3')
    expect(screen.queryByTestId('pagination-prev')).not.toBeInTheDocument()
    // Use toHaveBeenLastCalledWith to target the decrement call specifically
    expect(mockUseAlbumPage).toHaveBeenLastCalledWith(0, expect.anything())
  })
})

describe('AlbumListPage - sort resets page to 0', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resets to page 1 display when sort field changes after navigating to a later page', async () => {
    const user = userEvent.setup()
    mockUseAlbumPage.mockReturnValue(makePageResult({ totalPages: 3, totalElements: 60, page: 0 }))
    renderApp()

    // Navigate to page 1 (displays "Page 2 of 3")
    await user.click(screen.getByTestId('pagination-next'))
    expect(screen.getByTestId('pagination-info')).toHaveTextContent('Page 2 of 3')

    // Change sort field - the page counter should reset to 0 (displays "Page 1 of 3")
    const sortSelect = screen.getByRole('combobox', { name: 'Sort albums by' })
    await user.selectOptions(sortSelect, 'Composer')

    expect(screen.getByTestId('pagination-info')).toHaveTextContent('Page 1 of 3')
  })

  it('resets to page 1 display when sort direction changes after navigating to a later page', async () => {
    const user = userEvent.setup()
    mockUseAlbumPage.mockReturnValue(makePageResult({ totalPages: 3, totalElements: 60, page: 0 }))
    renderApp()

    // Navigate to page 1 (displays "Page 2 of 3")
    await user.click(screen.getByTestId('pagination-next'))
    expect(screen.getByTestId('pagination-info')).toHaveTextContent('Page 2 of 3')

    // Toggle sort direction - the page counter should reset to 0 (displays "Page 1 of 3")
    const directionBtn = screen.getByRole('button', { name: /sort ascending/i })
    await user.click(directionBtn)

    expect(screen.getByTestId('pagination-info')).toHaveTextContent('Page 1 of 3')
  })
})
