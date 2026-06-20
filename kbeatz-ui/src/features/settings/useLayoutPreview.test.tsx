import { renderHook, waitFor } from '@testing-library/react'
import { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { LayoutPreview } from '../../api/generated'

vi.mock('../../api/generated', () => ({
  SettingsService: { getLayoutPreview: vi.fn() },
}))

import { SettingsService } from '../../api/generated'
import { useLayoutPreview } from './useLayoutPreview'

const mockGet = vi.mocked(SettingsService.getLayoutPreview)

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const PREVIEW: LayoutPreview = {
  albumId: 'a-1',
  currentDirectory: 'incoming/kob',
  plannedDirectory: 'Miles Davis/Kind of Blue (1959)',
  withinLibraryRoot: true,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useLayoutPreview', () => {
  it('does not fetch and reports not-pending when no album is selected', () => {
    const { result } = renderHook(() => useLayoutPreview(null), { wrapper })
    expect(mockGet).not.toHaveBeenCalled()
    expect(result.current.preview).toBeUndefined()
    expect(result.current.isPending).toBe(false)
  })

  it('fetches the preview for the selected album', async () => {
    mockGet.mockResolvedValue(PREVIEW)
    const { result } = renderHook(() => useLayoutPreview('a-1'), { wrapper })

    await waitFor(() => expect(result.current.preview).toBeDefined())
    expect(result.current.preview).toEqual(PREVIEW)
    expect(mockGet).toHaveBeenCalledWith({ albumId: 'a-1' })
  })

  it('reports isError when the query rejects', async () => {
    mockGet.mockRejectedValue(new Error('fail'))
    const { result } = renderHook(() => useLayoutPreview('a-1'), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
