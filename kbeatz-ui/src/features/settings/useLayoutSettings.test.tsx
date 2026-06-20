import { renderHook, waitFor } from '@testing-library/react'
import { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { LayoutSettings } from '../../api/generated'

vi.mock('../../api/generated', () => ({
  SettingsService: { getLayoutSettings: vi.fn() },
}))

import { SettingsService } from '../../api/generated'
import { useLayoutSettings } from './useLayoutSettings'

const mockGet = vi.mocked(SettingsService.getLayoutSettings)

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const SETTINGS: LayoutSettings = {
  directoryTemplate: '${ALBUMARTIST}/${ALBUM}',
  supportedTokens: ['ALBUM', 'ALBUMARTIST'],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useLayoutSettings', () => {
  it('returns the settings once the query resolves', async () => {
    mockGet.mockResolvedValue(SETTINGS)
    const { result } = renderHook(() => useLayoutSettings(), { wrapper })

    await waitFor(() => expect(result.current.settings).toBeDefined())
    expect(result.current.settings).toEqual(SETTINGS)
    expect(result.current.isError).toBe(false)
  })

  it('returns isError when the query rejects', async () => {
    mockGet.mockRejectedValue(new Error('fail'))
    const { result } = renderHook(() => useLayoutSettings(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.settings).toBeUndefined()
  })

  it('returns named fields, not a tuple', async () => {
    mockGet.mockResolvedValue(SETTINGS)
    const { result } = renderHook(() => useLayoutSettings(), { wrapper })
    await waitFor(() => expect(result.current.settings).toBeDefined())
    expect(result.current).toHaveProperty('settings')
    expect(result.current).toHaveProperty('isPending')
    expect(result.current).toHaveProperty('isError')
    expect(Array.isArray(result.current)).toBe(false)
  })
})
