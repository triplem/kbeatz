import { render, screen, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { AlbumCard } from './album-card'
import type { Album } from '../../api/generated'

function makeAlbum(overrides: Partial<Album> = {}): Album {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    albumArtist: 'Miles Davis',
    album: 'Kind of Blue',
    date: '1959',
    genre: 'Jazz',
    directoryPath: '/music/jazz/kind-of-blue',
    hasCoverArt: false,
    ...overrides,
  }
}

describe('AlbumCard', () => {
  it('renders album title', () => {
    render(<AlbumCard album={makeAlbum()} />)
    expect(screen.getByText('Kind of Blue')).toBeInTheDocument()
  })

  it('renders albumArtist as primary attribution when composer is not set', () => {
    render(<AlbumCard album={makeAlbum({ composer: undefined })} />)
    expect(screen.getByText('Miles Davis')).toBeInTheDocument()
  })

  it('renders composer as primary attribution when composer is set', () => {
    render(
      <AlbumCard
        album={makeAlbum({
          composer: 'Johann Sebastian Bach',
          albumArtist: 'Berlin Philharmoniker',
        })}
      />,
    )
    expect(screen.getByText('Johann Sebastian Bach')).toBeInTheDocument()
    expect(screen.queryByText('Berlin Philharmoniker')).not.toBeInTheDocument()
  })

  it('renders year when date is present', () => {
    render(<AlbumCard album={makeAlbum({ date: '1959' })} />)
    expect(screen.getByText('1959')).toBeInTheDocument()
  })

  it('renders genre chip when genre is present', () => {
    render(<AlbumCard album={makeAlbum({ genre: 'Jazz' })} />)
    expect(screen.getByText('Jazz')).toBeInTheDocument()
  })

  it('shows placeholder SVG when hasCoverArt is false', () => {
    render(<AlbumCard album={makeAlbum({ hasCoverArt: false })} />)
    expect(screen.getByRole('img', { name: 'No cover art' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Cover art for/ })).not.toBeInTheDocument()
  })

  it('shows cover img when hasCoverArt is true', () => {
    render(<AlbumCard album={makeAlbum({ hasCoverArt: true })} />)
    const img = screen.getByRole('img', { name: 'Cover art for Kind of Blue' })
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute(
      'src',
      '/api/v1/albums/550e8400-e29b-41d4-a716-446655440000/cover',
    )
  })

  it('shows placeholder when cover image fails to load', async () => {
    render(<AlbumCard album={makeAlbum({ hasCoverArt: true })} />)
    const img = screen.getByRole('img', { name: 'Cover art for Kind of Blue' })
    // Simulate image load error wrapped in act to handle state update
    await act(async () => {
      img.dispatchEvent(new Event('error'))
    })
    // After error, placeholder should appear
    expect(screen.getByRole('img', { name: 'No cover art' })).toBeInTheDocument()
  })
})
