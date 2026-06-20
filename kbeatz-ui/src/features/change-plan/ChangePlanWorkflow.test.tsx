import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ChangePlanWorkflow } from './ChangePlanWorkflow'
import { ChangePlansService } from '../../api/generated'
import type { ApplyChangePlanResult, ChangePlan, ReleaseChangeSet } from '../../api/generated'

vi.mock('../../api/generated', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/generated')>()
  return {
    ...actual,
    ChangePlansService: {
      ...actual.ChangePlansService,
      createChangePlan: vi.fn(),
      applyChangePlan: vi.fn(),
    },
  }
})

const mockCreate = vi.mocked(ChangePlansService.createChangePlan)
const mockApply = vi.mocked(ChangePlansService.applyChangePlan)

function buildRelease(overrides: Partial<ReleaseChangeSet> = {}): ReleaseChangeSet {
  return {
    albumId: 'album-1',
    directoryMove: { albumId: 'album-1', fromPath: '/old', toPath: '/new', mergedFromPaths: [] },
    tagChanges: [],
    conflicts: [],
    hasConflicts: false,
    ...overrides,
  }
}

function buildPlan(overrides: Partial<ChangePlan> = {}): ChangePlan {
  return {
    id: 'plan-1',
    operation: 'RELAYOUT',
    releases: [buildRelease()],
    createdAt: '2026-06-20T00:00:00Z',
    totalMoves: 1,
    totalTagChanges: 0,
    totalConflicts: 0,
    hasConflicts: false,
    ...overrides,
  }
}

function buildApplyResult(overrides: Partial<ApplyChangePlanResult> = {}): ApplyChangePlanResult {
  return {
    planId: 'plan-1',
    releases: [{ albumId: 'album-1', outcome: 'APPLIED', message: null }],
    appliedCount: 1,
    skippedCount: 0,
    failedCount: 0,
    ...overrides,
  }
}

function renderWorkflow(props: {
  albumIds: readonly string[]
  onClose?: (applied: boolean) => void
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const onClose = props.onClose ?? vi.fn()
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <ChangePlanWorkflow operation="RELAYOUT" albumIds={props.albumIds} onClose={onClose} />
    </QueryClientProvider>,
  )
  return { ...utils, onClose }
}

describe('ChangePlanWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreate.mockResolvedValue(buildPlan())
    mockApply.mockResolvedValue(buildApplyResult())
  })

  it('requests a dry-run plan on mount with the given ids', async () => {
    renderWorkflow({ albumIds: ['album-1', 'album-2'] })
    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith({
      requestBody: { operation: 'RELAYOUT', albumIds: ['album-1', 'album-2'] },
    }))
    expect(mockApply).not.toHaveBeenCalled()
  })

  it('renders the review after the plan resolves', async () => {
    renderWorkflow({ albumIds: ['album-1'] })
    await waitFor(() => expect(screen.getByTestId('change-plan-review')).toBeInTheDocument())
    expect(screen.getByTestId('move-to')).toHaveTextContent('/new')
  })

  it('confirm triggers apply and shows per-release results', async () => {
    mockApply.mockResolvedValue(buildApplyResult({
      releases: [
        { albumId: 'album-1', outcome: 'APPLIED', message: null },
        { albumId: 'album-2', outcome: 'SKIPPED', message: 'conflict' },
      ],
      appliedCount: 1,
      skippedCount: 1,
    }))
    mockCreate.mockResolvedValue(buildPlan({
      releases: [buildRelease({ albumId: 'album-1' }), buildRelease({ albumId: 'album-2' })],
      totalMoves: 2,
    }))

    const { onClose } = renderWorkflow({ albumIds: ['album-1', 'album-2'] })
    await waitFor(() => expect(screen.getByTestId('change-plan-confirm')).toBeInTheDocument())
    await userEvent.click(screen.getByTestId('change-plan-confirm'))

    await waitFor(() => expect(mockApply).toHaveBeenCalledWith({ planId: 'plan-1' }))
    expect(onClose).toHaveBeenCalledWith(true)
  })

  it('cancel writes nothing and closes with applied=false', async () => {
    const { onClose } = renderWorkflow({ albumIds: ['album-1'] })
    await waitFor(() => expect(screen.getByTestId('change-plan-cancel')).toBeInTheDocument())
    await userEvent.click(screen.getByTestId('change-plan-cancel'))

    expect(mockApply).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledWith(false)
  })

  it('shows a planning error with retry when the dry run fails', async () => {
    mockCreate.mockRejectedValueOnce(new Error('boom'))
    renderWorkflow({ albumIds: ['album-1'] })
    await waitFor(() => expect(screen.getByTestId('change-plan-plan-error')).toBeInTheDocument())

    mockCreate.mockResolvedValue(buildPlan())
    await userEvent.click(screen.getByTestId('change-plan-plan-error-retry'))
    await waitFor(() => expect(screen.getByTestId('change-plan-review')).toBeInTheDocument())
  })

  it('renders an empty-plan message when there are no changes', async () => {
    mockCreate.mockResolvedValue(buildPlan({ releases: [], totalMoves: 0, totalTagChanges: 0 }))
    renderWorkflow({ albumIds: ['album-1'] })
    await waitFor(() => expect(screen.getByTestId('change-plan-empty')).toBeInTheDocument())
  })

  it('shows an apply error when apply rejects', async () => {
    mockApply.mockRejectedValue(new Error('apply failed'))
    renderWorkflow({ albumIds: ['album-1'] })
    await waitFor(() => expect(screen.getByTestId('change-plan-confirm')).toBeInTheDocument())
    await userEvent.click(screen.getByTestId('change-plan-confirm'))

    await waitFor(() => expect(screen.getByTestId('change-plan-apply-error')).toBeInTheDocument())
  })
})
