import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import { useAlbum } from './useAlbum'
import type { AlbumDetail } from '../../api/generated'

vi.mock('../../api/generated', () => ({
  AlbumsService: {
    getAlbum: vi.fn(),
  },
}))

import { AlbumsService } from '../../api/generated'
const mockGetAlbum = vi.mocked(AlbumsService.getAlbum)

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
    discogsId: undefined,
    directoryPath: '/music/kind-of-blue',
    hasCoverArt: false,
    tracks: [],
    ...overrides,
  }
}

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useAlbum', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns isPending=true while the query is in-flight', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetAlbum.mockReturnValue(new Promise(() => undefined) as any)
    const { result } = renderHook(() => useAlbum('album-1'), { wrapper: makeWrapper() })
    expect(result.current.isPending).toBe(true)
    expect(result.current.data).toBeUndefined()
  })

  it('returns album data when the query resolves', async () => {
    const album = makeAlbum()
    mockGetAlbum.mockResolvedValue(album)
    const { result } = renderHook(() => useAlbum('album-1'), { wrapper: makeWrapper() })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(album)
    expect(result.current.isPending).toBe(false)
  })

  it('returns isError=true when the query rejects', async () => {
    mockGetAlbum.mockRejectedValue(new Error('Network error'))
    const { result } = renderHook(() => useAlbum('album-1'), { wrapper: makeWrapper() })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error?.message).toBe('Network error')
  })

  it('does not fetch when id is undefined', () => {
    const { result } = renderHook(() => useAlbum(undefined), { wrapper: makeWrapper() })
    expect(mockGetAlbum).not.toHaveBeenCalled()
    expect(result.current.isPending).toBe(true)
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('does not fetch when id is an empty string', () => {
    const { result } = renderHook(() => useAlbum(''), { wrapper: makeWrapper() })
    expect(mockGetAlbum).not.toHaveBeenCalled()
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('passes the album id to the service', async () => {
    mockGetAlbum.mockResolvedValue(makeAlbum({ id: 'specific-id' }))
    const { result } = renderHook(() => useAlbum('specific-id'), { wrapper: makeWrapper() })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockGetAlbum).toHaveBeenCalledWith({ albumId: 'specific-id' })
  })
})
