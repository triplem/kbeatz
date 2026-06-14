import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import { useAlbumTagSave } from './useAlbumTagSave'
import type { AlbumDetail } from '../../api/generated'

vi.mock('../../api/generated', () => ({
  AlbumsService: {
    updateAlbumTags: vi.fn(),
  },
}))

import { AlbumsService } from '../../api/generated'
const mockUpdateTags = vi.mocked(AlbumsService.updateAlbumTags)

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
    albumPath: 'Jazz/Miles Davis/Kind of Blue',
    hasCoverArt: false,
    tracks: [],
    ...overrides,
  }
}

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useAlbumTagSave', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns isPending=false and error=null before any save is called', () => {
    const { result } = renderHook(() => useAlbumTagSave('album-1'), { wrapper: makeWrapper() })
    expect(result.current.isPending).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('returns named fields (not a tuple)', () => {
    const { result } = renderHook(() => useAlbumTagSave('album-1'), { wrapper: makeWrapper() })
    expect(result.current).toHaveProperty('save')
    expect(result.current).toHaveProperty('isPending')
    expect(result.current).toHaveProperty('error')
    expect(Array.isArray(result.current)).toBe(false)
  })

  it('calls the service with the correct album id, field, and value', async () => {
    const updated = makeAlbum({ genre: 'Classical' })
    mockUpdateTags.mockResolvedValue(updated)

    const { result } = renderHook(() => useAlbumTagSave('album-1'), { wrapper: makeWrapper() })

    await act(async () => {
      await result.current.save({ field: 'GENRE', value: 'Classical' })
    })

    expect(mockUpdateTags).toHaveBeenCalledWith({
      albumId: 'album-1',
      requestBody: { field: 'GENRE', value: 'Classical' },
    })
  })

  it('returns isPending=true while the mutation is in-flight', async () => {
    let resolve!: (value: AlbumDetail) => void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUpdateTags.mockReturnValue(new Promise<AlbumDetail>((r) => { resolve = r }) as any)

    const { result } = renderHook(() => useAlbumTagSave('album-1'), { wrapper: makeWrapper() })

    // Start the mutation but do not await it yet
    act(() => {
      void result.current.save({ field: 'GENRE', value: 'Jazz' })
    })

    await waitFor(() => {
      expect(result.current.isPending).toBe(true)
    })

    // Resolve and verify isPending goes back to false
    await act(async () => {
      resolve(makeAlbum())
    })

    await waitFor(() => {
      expect(result.current.isPending).toBe(false)
    })
  })

  it('populates error when the service rejects', async () => {
    mockUpdateTags.mockRejectedValue(new Error('Write failed'))

    const { result } = renderHook(() => useAlbumTagSave('album-1'), { wrapper: makeWrapper() })

    await act(async () => {
      await result.current.save({ field: 'GENRE', value: 'Jazz' }).catch(() => undefined)
    })

    await waitFor(() => {
      expect(result.current.error?.message).toBe('Write failed')
    })
    expect(result.current.isPending).toBe(false)
  })

  it('rejects with a descriptive error when id is undefined', async () => {
    const { result } = renderHook(() => useAlbumTagSave(undefined), { wrapper: makeWrapper() })

    await expect(
      act(async () => {
        await result.current.save({ field: 'GENRE', value: 'Jazz' })
      }),
    ).rejects.toThrow('Album id is required')

    expect(mockUpdateTags).not.toHaveBeenCalled()
  })
})
