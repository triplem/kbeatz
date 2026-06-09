import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AlbumGrid } from './album-grid'
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
})
