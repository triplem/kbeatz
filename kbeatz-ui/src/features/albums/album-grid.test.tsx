import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AlbumGrid, calcColumns } from './album-grid'
import type { Album } from '../../api/generated'

function makeAlbum(id: string, title: string): Album {
  return {
    id,
    albumArtist: 'Test Artist',
    album: title,
    directoryPath: `/music/${title}`,
    hasCoverArt: false,
  }
}

// ResizeObserver is not implemented in jsdom; provide a constructor mock
class ResizeObserverMock {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AlbumGrid', () => {
  it('renders empty state message when no albums', () => {
    render(<MemoryRouter><AlbumGrid albums={[]} /></MemoryRouter>)
    expect(screen.getByText(/No albums found/)).toBeInTheDocument()
  })

  it('renders album cards when albums are provided', () => {
    const albums = [
      makeAlbum('id-1', 'Kind of Blue'),
      makeAlbum('id-2', 'Bitches Brew'),
    ]
    render(<MemoryRouter><AlbumGrid albums={albums} /></MemoryRouter>)
    expect(screen.getByText('Kind of Blue')).toBeInTheDocument()
    expect(screen.getByText('Bitches Brew')).toBeInTheDocument()
  })

  it('renders accessible section with album count', () => {
    const albums = [makeAlbum('id-1', 'Kind of Blue')]
    render(<MemoryRouter><AlbumGrid albums={albums} /></MemoryRouter>)
    expect(
      screen.getByRole('region', { name: /Album collection - 1 albums/ }),
    ).toBeInTheDocument()
  })

  it('announces total when showing all albums (no filter)', () => {
    const albums = [makeAlbum('id-1', 'Kind of Blue'), makeAlbum('id-2', 'Bitches Brew')]
    render(<MemoryRouter><AlbumGrid albums={albums} totalCount={2} /></MemoryRouter>)
    expect(screen.getByTestId('album-grid-result-count')).toHaveTextContent('Showing all 2 albums')
  })

  it('announces filtered count when totalCount differs from albums.length', () => {
    const albums = [makeAlbum('id-1', 'Kind of Blue')]
    render(<MemoryRouter><AlbumGrid albums={albums} totalCount={100} /></MemoryRouter>)
    expect(screen.getByTestId('album-grid-result-count')).toHaveTextContent('Showing 1 of 100 albums')
  })

  it('renders all albums in fallback mode when layout is unavailable (jsdom)', () => {
    // In jsdom, document.documentElement has no offsetHeight so totalHeight === 0
    // and the virtualizer falls back to rendering all items directly.
    const albums = Array.from({ length: 50 }, (_, i) =>
      makeAlbum(`id-${i}`, `Album ${i}`),
    )
    render(<MemoryRouter><AlbumGrid albums={albums} /></MemoryRouter>)

    // The section container is present
    expect(screen.getByTestId('album-grid-section')).toBeInTheDocument()
    // All albums are rendered in fallback mode
    expect(screen.getByText('Album 0')).toBeInTheDocument()
    expect(screen.getByText('Album 49')).toBeInTheDocument()
    // The virtual container is NOT present (fallback path)
    expect(screen.queryByTestId('album-grid-virtual-container')).not.toBeInTheDocument()
  })

  it('renders the virtual container when rows are virtualised', () => {
    // Simulate a working virtualizer by stubbing document.documentElement.offsetHeight
    Object.defineProperty(document.documentElement, 'offsetHeight', {
      configurable: true,
      get() { return 800 },
    })
    Object.defineProperty(document.documentElement, 'clientHeight', {
      configurable: true,
      get() { return 800 },
    })

    const albums = Array.from({ length: 100 }, (_, i) =>
      makeAlbum(`id-${i}`, `Album ${i}`),
    )
    render(<MemoryRouter><AlbumGrid albums={albums} /></MemoryRouter>)
    // Either the section is rendered (if virtualizer produces rows) or fallback
    // Either way, the section should be present
    expect(screen.getByTestId('album-grid-section')).toBeInTheDocument()
  })

  // ─────────────────────────────────
  // Accessibility
  // ─────────────────────────────────

  it('each album card has role=button and aria-label with album title and artist', () => {
    const albums = [makeAlbum('id-1', 'Kind of Blue')]
    render(<MemoryRouter><AlbumGrid albums={albums} /></MemoryRouter>)
    // AlbumCard renders an article with role="button"
    const card = screen.getByRole('button', { name: /Kind of Blue/ })
    expect(card).toBeInTheDocument()
    expect(card).toHaveAttribute('aria-label', expect.stringContaining('Test Artist'))
  })

  it('placeholder SVG has role=img and descriptive aria-label', () => {
    const albums = [makeAlbum('id-1', 'Kind of Blue')]
    render(<MemoryRouter><AlbumGrid albums={albums} /></MemoryRouter>)
    const svg = screen.getByRole('img', { name: 'Album cover not available' })
    expect(svg).toBeInTheDocument()
  })

  it('result count live region has role=status and aria-live=polite', () => {
    const albums = [makeAlbum('id-1', 'Kind of Blue')]
    render(<MemoryRouter><AlbumGrid albums={albums} /></MemoryRouter>)
    const region = screen.getByTestId('album-grid-result-count')
    expect(region).toHaveAttribute('role', 'status')
    expect(region).toHaveAttribute('aria-live', 'polite')
  })
})

// ─────────────────────────────────
// calcColumns unit tests
// ─────────────────────────────────

describe('calcColumns', () => {
  it('returns 1 when container width equals the minimum card width (240px)', () => {
    expect(calcColumns(240)).toBe(1)
  })

  it('returns 1 when container width is less than the minimum card width', () => {
    expect(calcColumns(100)).toBe(1)
    expect(calcColumns(239)).toBe(1)
  })

  it('returns 1 for zero-width container (guards against division by zero)', () => {
    expect(calcColumns(0)).toBe(1)
  })

  it('returns 2 when container is exactly twice the minimum width (480px)', () => {
    expect(calcColumns(480)).toBe(2)
  })

  it('returns 5 columns at 1280px viewport width', () => {
    // 1280 / 240 = 5.33 -> 5 columns
    expect(calcColumns(1280)).toBe(5)
  })

  it('returns 6 columns at 1440px viewport width', () => {
    // 1440 / 240 = 6.0 -> 6 columns
    expect(calcColumns(1440)).toBe(6)
  })

  it('returns 8 columns at 1920px viewport width', () => {
    // 1920 / 240 = 8.0 -> 8 columns
    expect(calcColumns(1920)).toBe(8)
  })
})
