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

  it('renders all album cards when albums are provided', () => {
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
      screen.getByRole('region', { name: /Album collection — 1 albums/ }),
    ).toBeInTheDocument()
  })
})
