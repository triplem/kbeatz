import { renderHook, waitFor } from '@testing-library/react'
import { type ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Album, AlbumPage } from '../../api/generated'

vi.mock('../../api/generated', () => ({
  AlbumsService: { listAlbums: vi.fn() },
}))

import { AlbumsService } from '../../api/generated'
import { useAlbumPage, toServerParams } from './useAlbumPage'
import { EMPTY_FILTERS, type AlbumFilters } from './album-filters'

const mockListAlbums = vi.mocked(AlbumsService.listAlbums)

function makeAlbum(id: number): Album {
  return { id: `id-${id}`, albumArtist: `Artist ${id}`, album: `Album ${id}`, hasCoverArt: false, albumPath: `/m/${id}` }
}

function serverPage(content: Album[], pageNum: number, totalElements: number): AlbumPage {
  return { content, page: pageNum, size: 50, totalElements, totalPages: Math.ceil(totalElements / 50) }
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('toServerParams', () => {
  it('maps page/size and omits empty filters', () => {
    expect(toServerParams({ page: 2, size: 50, filters: EMPTY_FILTERS })).toEqual({ page: 2, size: 50 })
  })

  it('maps the first selected value of each multi-select axis and free-text query', () => {
    const filters: AlbumFilters = {
      artists: ['Miles Davis', 'John Coltrane'],
      composers: ['Bill Evans'],
      genres: ['Jazz'],
      query: '  blue  ',
    }
    expect(toServerParams({ page: 0, size: 25, filters })).toEqual({
      page: 0,
      size: 25,
      albumArtist: 'Miles Davis',
      composer: 'Bill Evans',
      genre: 'Jazz',
      q: 'blue',
    })
  })
})

describe('useAlbumPage', () => {
  it('fetches exactly one server page when enabled', async () => {
    mockListAlbums.mockResolvedValueOnce(serverPage([makeAlbum(0)], 1, 10000))
    const { result } = renderHook(
      () => useAlbumPage({ page: 1, size: 50, filters: EMPTY_FILTERS }, true),
      { wrapper },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.totalElements).toBe(10000)
    // Exactly one request - no full-set walk.
    expect(mockListAlbums).toHaveBeenCalledTimes(1)
    expect(mockListAlbums).toHaveBeenCalledWith({ page: 1, size: 50 })
  })

  it('does not fetch when disabled (client-side mode)', () => {
    renderHook(() => useAlbumPage({ page: 0, size: 50, filters: EMPTY_FILTERS }, false), { wrapper })
    expect(mockListAlbums).not.toHaveBeenCalled()
  })

  it('sends mapped filter params to the server', async () => {
    mockListAlbums.mockResolvedValueOnce(serverPage([makeAlbum(0)], 0, 6000))
    const filters: AlbumFilters = { artists: ['Bach'], composers: [], genres: ['Classical'], query: 'mass' }
    const { result } = renderHook(() => useAlbumPage({ page: 0, size: 50, filters }, true), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockListAlbums).toHaveBeenCalledWith({
      page: 0,
      size: 50,
      albumArtist: 'Bach',
      genre: 'Classical',
      q: 'mass',
    })
  })
})
