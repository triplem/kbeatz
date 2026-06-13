import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
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

  it('renders all albums in the grid', () => {
    const albums = Array.from({ length: 20 }, (_, i) =>
      makeAlbum(`id-${i}`, `Album ${i}`),
    )
    render(<MemoryRouter><AlbumGrid albums={albums} /></MemoryRouter>)
    expect(screen.getByTestId('album-grid-section')).toBeInTheDocument()
    expect(screen.getByText('Album 0')).toBeInTheDocument()
    expect(screen.getByText('Album 19')).toBeInTheDocument()
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
