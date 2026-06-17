import { describe, it, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AppThemeProvider } from '../../theme'
import { AlbumCard } from './album-card'
import type { Album } from '../../api/generated'
import { expectNoA11yViolationsInBothThemes } from '../../test/a11y'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

function makeAlbum(overrides: Partial<Album> = {}): Album {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    albumArtist: 'Miles Davis',
    album: 'Kind of Blue',
    date: '1959',
    genre: 'Jazz',
    albumPath: 'Jazz/Miles Davis/Kind of Blue',
    hasCoverArt: false,
    ...overrides,
  }
}

describe('AlbumCard accessibility', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.clearAllMocks()
  })

  it('has no WCAG 2.1 AA violations (both themes)', async () => {
    await expectNoA11yViolationsInBothThemes(() => (
      <AppThemeProvider>
        <MemoryRouter>
          <AlbumCard album={makeAlbum()} />
          <AlbumCard album={makeAlbum({ id: 'id-2', composer: 'J.S. Bach', hasCoverArt: true })} />
        </MemoryRouter>
      </AppThemeProvider>
    ))
  })
})
