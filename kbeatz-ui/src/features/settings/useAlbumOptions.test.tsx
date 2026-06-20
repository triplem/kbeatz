import { renderHook, waitFor } from '@testing-library/react'
import { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Album } from '../../api/generated'

vi.mock('../../api/generated', () => ({
  AlbumsService: { listAlbums: vi.fn() },
}))

import { AlbumsService } from '../../api/generated'
import { useAlbumOptions } from './useAlbumOptions'

const mockList = vi.mocked(AlbumsService.listAlbums)

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function makeAlbum(id: string): Album {
  return { id, albumArtist: `Artist ${id}`, album: `Album ${id}`, hasCoverArt: false, albumPath: `/m/${id}` }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useAlbumOptions', () => {
  it('returns the first page of albums and requests size 100', async () => {
    const albums = [makeAlbum('1'), makeAlbum('2')]
    mockList.mockResolvedValue({ content: albums, page: 0, size: 100, totalElements: 2, totalPages: 1 })

    const { result } = renderHook(() => useAlbumOptions(), { wrapper })

    await waitFor(() => expect(result.current.albums).toHaveLength(2))
    expect(mockList).toHaveBeenCalledWith({ page: 0, size: 100 })
    expect(result.current.isError).toBe(false)
  })

  it('returns an empty list and isError when the query rejects', async () => {
    mockList.mockRejectedValue(new Error('fail'))
    const { result } = renderHook(() => useAlbumOptions(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.albums).toEqual([])
  })
})
