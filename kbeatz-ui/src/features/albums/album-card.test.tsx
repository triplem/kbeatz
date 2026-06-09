import { render, screen, act, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AlbumCard } from './album-card'
import type { Album } from '../../api/generated'

// Mock react-router-dom navigate so we can assert navigation calls
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

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
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders album title', () => {
    render(<MemoryRouter><AlbumCard album={makeAlbum()} /></MemoryRouter>)
    expect(screen.getByText('Kind of Blue')).toBeInTheDocument()
  })

  it('renders albumArtist as primary attribution when composer is not set', () => {
    render(<MemoryRouter><AlbumCard album={makeAlbum({ composer: undefined })} /></MemoryRouter>)
    expect(screen.getByText('Miles Davis')).toBeInTheDocument()
  })

  it('renders composer as primary attribution when composer is set', () => {
    render(
      <MemoryRouter>
        <AlbumCard
          album={makeAlbum({
            composer: 'Johann Sebastian Bach',
            albumArtist: 'Berlin Philharmoniker',
          })}
        />
      </MemoryRouter>,
    )
    expect(screen.getByText('Johann Sebastian Bach')).toBeInTheDocument()
    expect(screen.queryByText('Berlin Philharmoniker')).not.toBeInTheDocument()
  })

  it('renders year when date is present', () => {
    render(<MemoryRouter><AlbumCard album={makeAlbum({ date: '1959' })} /></MemoryRouter>)
    expect(screen.getByText('1959')).toBeInTheDocument()
  })

  it('renders genre chip when genre is present', () => {
    render(<MemoryRouter><AlbumCard album={makeAlbum({ genre: 'Jazz' })} /></MemoryRouter>)
    expect(screen.getByText('Jazz')).toBeInTheDocument()
  })

  it('shows placeholder SVG when hasCoverArt is false', () => {
    render(<MemoryRouter><AlbumCard album={makeAlbum({ hasCoverArt: false })} /></MemoryRouter>)
    expect(screen.getByRole('img', { name: 'Album cover not available' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Cover art for/ })).not.toBeInTheDocument()
  })

  it('shows cover img when hasCoverArt is true', () => {
    render(<MemoryRouter><AlbumCard album={makeAlbum({ hasCoverArt: true })} /></MemoryRouter>)
    const img = screen.getByRole('img', { name: 'Cover art for Kind of Blue' })
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute(
      'src',
      '/api/v1/albums/550e8400-e29b-41d4-a716-446655440000/cover',
    )
  })

  it('shows placeholder when cover image fails to load', async () => {
    render(<MemoryRouter><AlbumCard album={makeAlbum({ hasCoverArt: true })} /></MemoryRouter>)
    const img = screen.getByRole('img', { name: 'Cover art for Kind of Blue' })
    // Simulate image load error wrapped in act to handle state update
    await act(async () => {
      img.dispatchEvent(new Event('error'))
    })
    // After error, placeholder should appear
    expect(screen.getByRole('img', { name: 'Album cover not available' })).toBeInTheDocument()
  })

  // ──────────────────────────────────────────────
  // Accessibility / keyboard navigation
  // ──────────────────────────────────────────────

  it('card has tabIndex=0 and role="button" for keyboard accessibility', () => {
    render(<MemoryRouter><AlbumCard album={makeAlbum()} /></MemoryRouter>)
    const card = screen.getByRole('button', { name: /View details for Kind of Blue/ })
    expect(card).toHaveAttribute('tabindex', '0')
  })

  it('navigates to album detail on Enter keydown', () => {
    render(<MemoryRouter><AlbumCard album={makeAlbum()} /></MemoryRouter>)
    const card = screen.getByRole('button', { name: /View details for Kind of Blue/ })
    fireEvent.keyDown(card, { key: 'Enter' })
    expect(mockNavigate).toHaveBeenCalledWith('/albums/550e8400-e29b-41d4-a716-446655440000')
  })

  it('navigates to album detail on Space keydown', () => {
    render(<MemoryRouter><AlbumCard album={makeAlbum()} /></MemoryRouter>)
    const card = screen.getByRole('button', { name: /View details for Kind of Blue/ })
    fireEvent.keyDown(card, { key: ' ' })
    expect(mockNavigate).toHaveBeenCalledWith('/albums/550e8400-e29b-41d4-a716-446655440000')
  })

  it('does not navigate on other key presses', () => {
    render(<MemoryRouter><AlbumCard album={makeAlbum()} /></MemoryRouter>)
    const card = screen.getByRole('button', { name: /View details for Kind of Blue/ })
    fireEvent.keyDown(card, { key: 'Tab' })
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('navigates to album detail on click', () => {
    render(<MemoryRouter><AlbumCard album={makeAlbum()} /></MemoryRouter>)
    const card = screen.getByRole('button', { name: /View details for Kind of Blue/ })
    fireEvent.click(card)
    expect(mockNavigate).toHaveBeenCalledWith('/albums/550e8400-e29b-41d4-a716-446655440000')
  })
})
