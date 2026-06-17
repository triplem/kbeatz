import { renderHook, waitFor } from '@testing-library/react'
import { type ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Album, AlbumPage } from '../../api/generated'
import { CLIENT_SIDE_THRESHOLD } from './album-list-mode'
import { EMPTY_FILTERS } from './album-filters'

vi.mock('../../api/generated', () => ({
  AlbumsService: { listAlbums: vi.fn() },
}))

import { AlbumsService } from '../../api/generated'
import { useAlbumList } from './useAlbumList'

const mockListAlbums = vi.mocked(AlbumsService.listAlbums)

function makeAlbum(i: number): Album {
  return { id: `id-${i}`, albumArtist: `Artist ${String(i).padStart(4, '0')}`, album: `Album ${i}`, hasCoverArt: false, albumPath: `/m/${i}` }
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const baseArgs = { page: 1, pageSize: 48, filters: EMPTY_FILTERS, sortBy: 'albumArtist' as const, sortDirection: 'asc' as const }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useAlbumList', () => {
  it('client mode: slices the filtered set and derives filter options', async () => {
    const albums = Array.from({ length: 60 }, (_, i) => makeAlbum(i))
    mockListAlbums.mockResolvedValueOnce({ content: albums, page: 0, size: 100, totalElements: 60, totalPages: 1 } as AlbumPage)

    const { result } = renderHook(() => useAlbumList(baseArgs), { wrapper })
    await waitFor(() => expect(result.current.isPending).toBe(false))

    expect(result.current.mode).toBe('client')
    expect(result.current.albums).toHaveLength(48) // one page slice
    expect(result.current.totalCount).toBe(60)
    expect(result.current.filterOptions.artists.length).toBeGreaterThan(0)
  })

  it('client mode: clamps an out-of-range page to the last page', async () => {
    const albums = Array.from({ length: 60 }, (_, i) => makeAlbum(i))
    mockListAlbums.mockResolvedValueOnce({ content: albums, page: 0, size: 100, totalElements: 60, totalPages: 1 } as AlbumPage)

    const { result } = renderHook(() => useAlbumList({ ...baseArgs, page: 999 }), { wrapper })
    await waitFor(() => expect(result.current.isPending).toBe(false))
    // 60 albums / 48 = 2 pages; page 999 clamps to page 2 = 12 remaining albums.
    expect(result.current.albums).toHaveLength(12)
  })

  it('server mode: returns the server page content and total, empty filter options', async () => {
    const over = CLIENT_SIDE_THRESHOLD + 100
    mockListAlbums.mockImplementation((q) =>
      Promise.resolve({
        content: [makeAlbum(q.page ?? 0)],
        page: q.page ?? 0,
        size: q.size ?? 48,
        totalElements: over,
        totalPages: Math.ceil(over / (q.size ?? 48)),
      } as AlbumPage) as ReturnType<typeof AlbumsService.listAlbums>,
    )

    const { result } = renderHook(() => useAlbumList({ ...baseArgs, page: 2 }), { wrapper })
    await waitFor(() => expect(result.current.mode).toBe('server'))
    await waitFor(() => expect(result.current.albums.length).toBe(1))

    expect(result.current.totalCount).toBe(over)
    expect(result.current.filterOptions.artists).toHaveLength(0)
    // Server queried for the 0-based index of UI page 2 = 1.
    expect(mockListAlbums).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }))
  })

  it('surfaces the probe error', async () => {
    mockListAlbums.mockRejectedValueOnce(new Error('boom'))
    const { result } = renderHook(() => useAlbumList(baseArgs), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
