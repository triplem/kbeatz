import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { AlbumHeroHeader } from './album-hero-header'
import type { AlbumDetail } from '../../api/generated'

function makeAlbum(overrides: Partial<AlbumDetail> = {}): AlbumDetail {
  return {
    id: 'album-1',
    albumArtist: 'Miles Davis',
    album: 'Kind of Blue',
    date: '1959',
    genre: 'Jazz',
    label: 'Columbia',
    catalogNumber: 'CL 1355',
    composer: undefined,
    conductor: undefined,
    ensemble: undefined,
    country: undefined,
    mediaFormat: undefined,
    discogsId: undefined,
    albumPath: 'Jazz/Miles Davis/Kind of Blue',
    hasCoverArt: false,
    tracks: [],
    ...overrides,
  }
}

function renderHero(album: AlbumDetail) {
  return render(<AlbumHeroHeader album={album} />)
}

describe('AlbumHeroHeader', () => {
  it('renders the artist name', () => {
    renderHero(makeAlbum())
    expect(screen.getByTestId('hero-artist')).toHaveTextContent('Miles Davis')
  })

  it('renders the album title', () => {
    renderHero(makeAlbum())
    expect(screen.getByTestId('hero-album-title')).toHaveTextContent('Kind of Blue')
  })

  it('renders label and catalog number combined when both present', () => {
    renderHero(makeAlbum({ label: 'Columbia', catalogNumber: 'CL 1355' }))
    expect(screen.getByTestId('hero-label-catalog')).toHaveTextContent('Columbia - CL 1355')
  })

  it('renders only the label when catalog number is absent', () => {
    renderHero(makeAlbum({ label: 'Columbia', catalogNumber: undefined }))
    expect(screen.getByTestId('hero-label-catalog')).toHaveTextContent('Columbia')
  })

  it('renders only the catalog number when label is absent', () => {
    renderHero(makeAlbum({ label: undefined, catalogNumber: 'CL 1355' }))
    expect(screen.getByTestId('hero-label-catalog')).toHaveTextContent('CL 1355')
  })

  it('omits label/catalog row when both are absent', () => {
    renderHero(makeAlbum({ label: undefined, catalogNumber: undefined }))
    expect(screen.queryByTestId('hero-label-catalog')).toBeNull()
  })

  it('renders release date when present', () => {
    renderHero(makeAlbum({ date: '1959' }))
    expect(screen.getByTestId('hero-release-date')).toBeInTheDocument()
  })

  it('omits release date when absent', () => {
    renderHero(makeAlbum({ date: undefined }))
    expect(screen.queryByTestId('hero-release-date')).toBeNull()
  })

  it('renders genre as chips when present', () => {
    renderHero(makeAlbum({ genre: 'Jazz, Blues' }))
    const chips = screen.getByTestId('hero-genre-chips')
    expect(chips).toBeInTheDocument()
    expect(chips).toHaveTextContent('Jazz')
    expect(chips).toHaveTextContent('Blues')
  })

  it('omits genre chips when genre is absent', () => {
    renderHero(makeAlbum({ genre: undefined }))
    expect(screen.queryByTestId('hero-genre-chips')).toBeNull()
  })

  it('renders country when present', () => {
    renderHero(makeAlbum({ country: 'US' }))
    expect(screen.getByTestId('hero-country')).toHaveTextContent('US')
  })

  it('omits country row when absent', () => {
    renderHero(makeAlbum({ country: undefined }))
    expect(screen.queryByTestId('hero-country')).toBeNull()
  })

  it('renders media format when present', () => {
    renderHero(makeAlbum({ mediaFormat: 'Vinyl' }))
    expect(screen.getByTestId('hero-media-format')).toHaveTextContent('Vinyl')
  })

  it('omits media format row when absent', () => {
    renderHero(makeAlbum({ mediaFormat: undefined }))
    expect(screen.queryByTestId('hero-media-format')).toBeNull()
  })

  it('shows cover art image when hasCoverArt is true', () => {
    renderHero(makeAlbum({ hasCoverArt: true, id: 'album-42' }))
    const img = screen.getByTestId('hero-cover-art')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', '/api/v1/albums/album-42/cover')
  })

  it('hides cover art when hasCoverArt is false', () => {
    renderHero(makeAlbum({ hasCoverArt: false }))
    expect(screen.queryByTestId('hero-cover-art')).toBeNull()
  })

  it('renders placeholder element when hasCoverArt is false', () => {
    renderHero(makeAlbum({ hasCoverArt: false }))
    expect(screen.getByTestId('hero-cover-placeholder')).toBeInTheDocument()
  })

  it('renders all fields when all are populated', () => {
    renderHero(
      makeAlbum({
        hasCoverArt: true,
        genre: 'Jazz',
        country: 'US',
        mediaFormat: 'CD',
        date: '1959',
        label: 'Columbia',
        catalogNumber: 'CL 1355',
      }),
    )
    expect(screen.getByTestId('hero-cover-art')).toBeInTheDocument()
    expect(screen.getByTestId('hero-artist')).toBeInTheDocument()
    expect(screen.getByTestId('hero-album-title')).toBeInTheDocument()
    expect(screen.getByTestId('hero-label-catalog')).toBeInTheDocument()
    expect(screen.getByTestId('hero-release-date')).toBeInTheDocument()
    expect(screen.getByTestId('hero-genre-chips')).toBeInTheDocument()
    expect(screen.getByTestId('hero-country')).toBeInTheDocument()
    expect(screen.getByTestId('hero-media-format')).toBeInTheDocument()
  })

  it('renders only artist and title when all optional fields are absent', () => {
    renderHero(
      makeAlbum({
        hasCoverArt: false,
        genre: undefined,
        country: undefined,
        mediaFormat: undefined,
        date: undefined,
        label: undefined,
        catalogNumber: undefined,
      }),
    )
    expect(screen.getByTestId('hero-artist')).toBeInTheDocument()
    expect(screen.getByTestId('hero-album-title')).toBeInTheDocument()
    expect(screen.queryByTestId('hero-cover-art')).toBeNull()
    expect(screen.queryByTestId('hero-label-catalog')).toBeNull()
    expect(screen.queryByTestId('hero-release-date')).toBeNull()
    expect(screen.queryByTestId('hero-genre-chips')).toBeNull()
    expect(screen.queryByTestId('hero-country')).toBeNull()
    expect(screen.queryByTestId('hero-media-format')).toBeNull()
  })
})
