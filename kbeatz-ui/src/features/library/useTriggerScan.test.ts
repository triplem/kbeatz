import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import { useTriggerScan } from './useTriggerScan'
import type { ScanStatus } from '../../api/generated'

vi.mock('../../api/generated', () => ({
  LibraryService: {
    triggerLibraryScan: vi.fn(),
  },
}))

import { LibraryService } from '../../api/generated'
const mockTriggerScan = vi.mocked(LibraryService.triggerLibraryScan)

function makeStatus(
  state: ScanStatus['state'],
  overrides: Partial<ScanStatus> = {},
): ScanStatus {
  return { state, ...overrides }
}

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useTriggerScan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns trigger function, isPending, and error fields', () => {
    mockTriggerScan.mockResolvedValue(makeStatus('COMPLETED'))
    const { result } = renderHook(() => useTriggerScan(), { wrapper: makeWrapper() })

    expect(typeof result.current.trigger).toBe('function')
    expect(result.current.isPending).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('returns an object (not a tuple)', () => {
    mockTriggerScan.mockResolvedValue(makeStatus('COMPLETED'))
    const { result } = renderHook(() => useTriggerScan(), { wrapper: makeWrapper() })

    expect(Array.isArray(result.current)).toBe(false)
    expect(result.current).toHaveProperty('trigger')
    expect(result.current).toHaveProperty('isPending')
    expect(result.current).toHaveProperty('error')
  })

  it('sets isPending=true while the mutation is in-flight', async () => {
    let resolvePromise!: () => void
    const pendingPromise = new Promise<ScanStatus>((res) => {
      resolvePromise = () => res(makeStatus('COMPLETED'))
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockTriggerScan.mockReturnValue(pendingPromise as any)

    const { result } = renderHook(() => useTriggerScan(), { wrapper: makeWrapper() })

    act(() => {
      result.current.trigger()
    })

    await waitFor(() => {
      expect(result.current.isPending).toBe(true)
    })

    await act(async () => {
      resolvePromise()
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(result.current.isPending).toBe(false)
    })
  })

  it('calls LibraryService.triggerLibraryScan when trigger is invoked', async () => {
    mockTriggerScan.mockResolvedValue(makeStatus('COMPLETED'))
    const { result } = renderHook(() => useTriggerScan(), { wrapper: makeWrapper() })

    act(() => {
      result.current.trigger()
    })

    await waitFor(() => {
      expect(mockTriggerScan).toHaveBeenCalledTimes(1)
    })
  })

  it('sets error when the mutation rejects', async () => {
    mockTriggerScan.mockRejectedValue(new Error('Network failure'))
    const { result } = renderHook(() => useTriggerScan(), { wrapper: makeWrapper() })

    act(() => {
      result.current.trigger()
    })

    await waitFor(() => {
      expect(result.current.error).not.toBeNull()
    })

    expect(result.current.isPending).toBe(false)
  })
})
