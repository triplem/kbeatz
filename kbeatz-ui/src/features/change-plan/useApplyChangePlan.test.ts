import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import { useApplyChangePlan } from './useApplyChangePlan'
import type { ApplyChangePlanResult } from '../../api/generated'

vi.mock('../../api/generated', () => ({
  ChangePlansService: {
    applyChangePlan: vi.fn(),
  },
}))

import { ChangePlansService } from '../../api/generated'
const mockApply = vi.mocked(ChangePlansService.applyChangePlan)

function buildResult(): ApplyChangePlanResult {
  return {
    planId: 'plan-1',
    releases: [{ albumId: 'a', outcome: 'APPLIED', message: null }],
    appliedCount: 1,
    skippedCount: 0,
    failedCount: 0,
  }
}

function makeContext() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
  return { queryClient, wrapper }
}

describe('useApplyChangePlan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns named fields (not a tuple)', () => {
    const { wrapper } = makeContext()
    const { result } = renderHook(() => useApplyChangePlan(), { wrapper })
    expect(result.current).toHaveProperty('apply')
    expect(result.current).toHaveProperty('result')
    expect(result.current).toHaveProperty('isPending')
    expect(result.current).toHaveProperty('error')
  })

  it('calls the service with the plan id', async () => {
    mockApply.mockResolvedValue(buildResult())
    const { wrapper } = makeContext()
    const { result } = renderHook(() => useApplyChangePlan(), { wrapper })

    await act(async () => {
      await result.current.apply('plan-1')
    })

    expect(mockApply).toHaveBeenCalledWith({ planId: 'plan-1' })
  })

  it('invalidates the albums and scan-status queries on success', async () => {
    mockApply.mockResolvedValue(buildResult())
    const { queryClient, wrapper } = makeContext()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useApplyChangePlan(), { wrapper })

    await act(async () => {
      await result.current.apply('plan-1')
    })

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['albums'] })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['scan-status'] })
    })
  })

  it('exposes the result on success', async () => {
    const apiResult = buildResult()
    mockApply.mockResolvedValue(apiResult)
    const { wrapper } = makeContext()
    const { result } = renderHook(() => useApplyChangePlan(), { wrapper })

    await act(async () => {
      await result.current.apply('plan-1')
    })

    await waitFor(() => expect(result.current.result).toEqual(apiResult))
  })

  it('populates error when the service rejects', async () => {
    mockApply.mockRejectedValue(new Error('apply failed'))
    const { wrapper } = makeContext()
    const { result } = renderHook(() => useApplyChangePlan(), { wrapper })

    await act(async () => {
      await result.current.apply('plan-1').catch(() => undefined)
    })

    await waitFor(() => expect(result.current.error?.message).toBe('apply failed'))
  })
})
