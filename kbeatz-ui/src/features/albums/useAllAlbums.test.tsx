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
import { CLIENT_SIDE_THRESHOLD } from './album-list-mode'

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

function page(content: Album[], pageNum: number, totalPages: number, totalElements: number): AlbumPage {
  return { content, page: pageNum, size: 100, totalElements, totalPages }
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useAllAlbums', () => {
  it('returns client mode with a single page when there is only one', async () => {
    mockListAlbums.mockResolvedValueOnce(page([makeAlbum(0), makeAlbum(1)], 0, 1, 2))
    const { result } = renderHook(() => useAllAlbums(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.mode).toBe('client')
    expect(result.current.data?.albums).toHaveLength(2)
    expect(result.current.data?.totalElements).toBe(2)
    expect(mockListAlbums).toHaveBeenCalledTimes(1)
    expect(mockListAlbums).toHaveBeenCalledWith({ page: 0, size: 100 })
  })

  it('walks all pages and concatenates the results in client mode', async () => {
    mockListAlbums
      .mockResolvedValueOnce(page([makeAlbum(0), makeAlbum(1)], 0, 3, 5))
      .mockResolvedValueOnce(page([makeAlbum(2), makeAlbum(3)], 1, 3, 5))
      .mockResolvedValueOnce(page([makeAlbum(4)], 2, 3, 5))
    const { result } = renderHook(() => useAllAlbums(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.mode).toBe('client')
    expect(result.current.data?.albums).toHaveLength(5)
    expect(mockListAlbums).toHaveBeenCalledTimes(3)
  })

  it('switches to server mode above the threshold without loading the full set', async () => {
    // Collection larger than the threshold: only page 0 is fetched, no full
    // load (this is the fix for the silent 5 000-album truncation, NFR-11/12).
    const overThreshold = CLIENT_SIDE_THRESHOLD + 1
    mockListAlbums.mockResolvedValueOnce(
      page([makeAlbum(0)], 0, Math.ceil(overThreshold / 100), overThreshold),
    )
    const { result } = renderHook(() => useAllAlbums(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.mode).toBe('server')
    expect(result.current.data?.totalElements).toBe(overThreshold)
    expect(result.current.data?.albums).toHaveLength(0)
    // Exactly one fetch: the full set is NOT walked.
    expect(mockListAlbums).toHaveBeenCalledTimes(1)
  })

  it('stays in client mode exactly at the threshold (boundary)', async () => {
    mockListAlbums.mockResolvedValueOnce(
      page([makeAlbum(0)], 0, 1, CLIENT_SIDE_THRESHOLD),
    )
    const { result } = renderHook(() => useAllAlbums(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.mode).toBe('client')
  })

  it('surfaces an error when the request fails', async () => {
    mockListAlbums.mockRejectedValueOnce(new Error('network'))
    const { result } = renderHook(() => useAllAlbums(), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
