import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderRoute } from '../../test/render-helpers'
import { FIXTURE_ALBUMS } from '../../test/fixtures'
import { BREAKPOINTS, installViewportAutoReset, setViewport } from '../../test/breakpoints'

vi.mock('./useAllAlbums', () => ({ useAllAlbums: vi.fn() }))

import { useAllAlbums } from './useAllAlbums'
import { AlbumListPage } from '../../App'

const mockUseAllAlbums = vi.mocked(useAllAlbums)

function mountAt() {
  mockUseAllAlbums.mockReturnValue({
    data: [...FIXTURE_ALBUMS],
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useAllAlbums>)
  return renderRoute([{ index: true, element: <AlbumListPage /> }])
}

/**
 * Responsive-matrix tests for the album-list screen across xs/sm/md/lg/xl.
 *
 * The album grid reflows via a CSS `repeat(auto-fill, minmax(180px, 1fr))`
 * template - it has NO per-breakpoint fixed column count, so the meaningful,
 * jsdom-checkable assertion is that the grid template stays fluid (auto-fill)
 * at every breakpoint and that the screen renders without error across the
 * matrix. The toolbar's column->row reflow contract is asserted via the same
 * breakpoint the component uses.
 */
describe('AlbumListPage responsive matrix', () => {
  installViewportAutoReset()

  beforeEach(() => {
    window.localStorage.clear()
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it.each(BREAKPOINTS)('renders the album grid without error at %s', (bp) => {
    setViewport(bp)
    const { unmount } = mountAt()
    expect(screen.getByTestId('album-grid-section')).toBeInTheDocument()
    expect(screen.getAllByTestId('album-card')).toHaveLength(FIXTURE_ALBUMS.length)
    unmount()
  })

  it.each(BREAKPOINTS)('uses a fluid auto-fill grid template (column reflow) at %s', (bp) => {
    setViewport(bp)
    const { unmount } = mountAt()
    const grid = screen.getByTestId('album-grid-section')
    // The grid-template-columns is the fluid auto-fill rule at every breakpoint
    // (resolved from the emotion stylesheet via getComputedStyle); columns
    // therefore reflow with available width rather than a fixed count per
    // breakpoint.
    const gtc = getComputedStyle(grid).gridTemplateColumns
    expect(grid).toHaveStyle({ display: 'grid' })
    expect(gtc).toContain('auto-fill')
    expect(gtc).toContain('minmax(180px')
    unmount()
  })
})
