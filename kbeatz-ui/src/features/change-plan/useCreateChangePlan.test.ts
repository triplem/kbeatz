import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import { useCreateChangePlan } from './useCreateChangePlan'
import type { ChangePlan } from '../../api/generated'

vi.mock('../../api/generated', () => ({
  ChangePlansService: {
    createChangePlan: vi.fn(),
  },
}))

import { ChangePlansService } from '../../api/generated'
const mockCreate = vi.mocked(ChangePlansService.createChangePlan)

function buildPlan(): ChangePlan {
  return {
    id: 'plan-1',
    operation: 'RELAYOUT',
    releases: [],
    createdAt: '2026-06-20T00:00:00Z',
    totalMoves: 0,
    totalTagChanges: 0,
    totalConflicts: 0,
    hasConflicts: false,
  }
}

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useCreateChangePlan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns named fields (not a tuple)', () => {
    const { result } = renderHook(() => useCreateChangePlan(), { wrapper: makeWrapper() })
    expect(result.current).toHaveProperty('createPlan')
    expect(result.current).toHaveProperty('plan')
    expect(result.current).toHaveProperty('isPending')
    expect(result.current).toHaveProperty('error')
    expect(Array.isArray(result.current)).toBe(false)
  })

  it('calls the service with the operation and album ids', async () => {
    mockCreate.mockResolvedValue(buildPlan())
    const { result } = renderHook(() => useCreateChangePlan(), { wrapper: makeWrapper() })

    await act(async () => {
      await result.current.createPlan({ operation: 'RELAYOUT', albumIds: ['a', 'b'] })
    })

    expect(mockCreate).toHaveBeenCalledWith({
      requestBody: { operation: 'RELAYOUT', albumIds: ['a', 'b'] },
    })
  })

  it('exposes the returned plan on success', async () => {
    const plan = buildPlan()
    mockCreate.mockResolvedValue(plan)
    const { result } = renderHook(() => useCreateChangePlan(), { wrapper: makeWrapper() })

    await act(async () => {
      await result.current.createPlan({ operation: 'RELAYOUT', albumIds: ['a'] })
    })

    await waitFor(() => expect(result.current.plan).toEqual(plan))
  })

  it('populates error when the service rejects', async () => {
    mockCreate.mockRejectedValue(new Error('plan failed'))
    const { result } = renderHook(() => useCreateChangePlan(), { wrapper: makeWrapper() })

    await act(async () => {
      await result.current.createPlan({ operation: 'RELAYOUT', albumIds: ['a'] }).catch(() => undefined)
    })

    await waitFor(() => expect(result.current.error?.message).toBe('plan failed'))
  })
})
