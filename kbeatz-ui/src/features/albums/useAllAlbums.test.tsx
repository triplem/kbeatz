import { renderHook, waitFor } from '@testing-library/react'
import { type ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Album, AlbumPage } from '../../api/generated'

vi.mock('../../api/generated', () => ({
  AlbumsService: { listAlbums: vi.fn() },
}))

import { AlbumsService } from '../../api/generated'
import { useAllAlbums } from './useAllAlbums'

const mockListAlbums = vi.mocked(AlbumsService.listAlbums)

function makeAlbum(id: number): Album {
  return {
    id: `id-${id}`,
    albumArtist: `Artist ${id}`,
    album: `Album ${id}`,
    hasCoverArt: false,
    albumPath: `/m/${id}`,
  }
}

function page(content: Album[], pageNum: number, totalPages: number): AlbumPage {
  return { content, page: pageNum, size: 100, totalElements: 0, totalPages }
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useAllAlbums', () => {
  it('returns a single page when there is only one', async () => {
    mockListAlbums.mockResolvedValueOnce(page([makeAlbum(0), makeAlbum(1)], 0, 1))
    const { result } = renderHook(() => useAllAlbums(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(2)
    expect(mockListAlbums).toHaveBeenCalledTimes(1)
    expect(mockListAlbums).toHaveBeenCalledWith({ page: 0, size: 100 })
  })

  it('walks all pages and concatenates the results', async () => {
    mockListAlbums
      .mockResolvedValueOnce(page([makeAlbum(0), makeAlbum(1)], 0, 3))
      .mockResolvedValueOnce(page([makeAlbum(2), makeAlbum(3)], 1, 3))
      .mockResolvedValueOnce(page([makeAlbum(4)], 2, 3))
    const { result } = renderHook(() => useAllAlbums(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(5)
    expect(mockListAlbums).toHaveBeenCalledTimes(3)
  })

  it('surfaces an error when the request fails', async () => {
    mockListAlbums.mockRejectedValueOnce(new Error('network'))
    const { result } = renderHook(() => useAllAlbums(), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
