import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ChangePlanReview } from './ChangePlanReview'
import type { ChangePlan, ReleaseChangeSet } from '../../api/generated'

function buildRelease(overrides: Partial<ReleaseChangeSet> = {}): ReleaseChangeSet {
  return {
    albumId: 'album-1',
    directoryMove: null,
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
    totalMoves: 0,
    totalTagChanges: 0,
    totalConflicts: 0,
    hasConflicts: false,
    ...overrides,
  }
}

describe('ChangePlanReview', () => {
  it('renders "no changes needed" for an empty plan', () => {
    render(<ChangePlanReview plan={buildPlan({ releases: [] })} />)
    expect(screen.getByTestId('change-plan-empty')).toBeInTheDocument()
  })

  it('renders consolidated totals', () => {
    const plan = buildPlan({ totalMoves: 2, totalTagChanges: 3, totalConflicts: 1 })
    render(<ChangePlanReview plan={plan} />)
    expect(screen.getByTestId('total-moves')).toHaveTextContent('2 directory moves')
    expect(screen.getByTestId('total-tag-changes')).toHaveTextContent('3 tag changes')
    expect(screen.getByTestId('total-conflicts')).toHaveTextContent('1 conflict')
  })

  it('renders a directory move as from -> to', () => {
    const plan = buildPlan({
      totalMoves: 1,
      releases: [buildRelease({
        directoryMove: {
          albumId: 'album-1',
          fromPath: '/music/old',
          toPath: '/music/new',
          mergedFromPaths: [],
        },
      })],
    })
    render(<ChangePlanReview plan={plan} />)
    expect(screen.getByTestId('move-from')).toHaveTextContent('/music/old')
    expect(screen.getByTestId('move-to')).toHaveTextContent('/music/new')
  })

  it('renders "already in place" when there is no move', () => {
    const plan = buildPlan({ releases: [buildRelease()] })
    render(<ChangePlanReview plan={plan} />)
    expect(screen.getByTestId('move-diff-none')).toBeInTheDocument()
  })

  it('renders tag diffs with current and proposed values', () => {
    const plan = buildPlan({
      totalTagChanges: 1,
      releases: [buildRelease({
        tagChanges: [{ targetPath: 'p', field: 'GENRE', currentValue: 'Jazz', proposedValue: 'Modal Jazz' }],
      })],
    })
    render(<ChangePlanReview plan={plan} />)
    expect(screen.getByTestId('tag-diff-current-GENRE')).toHaveTextContent('Jazz')
    expect(screen.getByTestId('tag-diff-proposed-GENRE')).toHaveTextContent('Modal Jazz')
  })

  it('renders an empty placeholder for a cleared value', () => {
    const plan = buildPlan({
      totalTagChanges: 1,
      releases: [buildRelease({
        tagChanges: [{ targetPath: 'p', field: 'GENRE', currentValue: 'Jazz', proposedValue: null }],
      })],
    })
    render(<ChangePlanReview plan={plan} />)
    expect(screen.getByTestId('tag-diff-proposed-GENRE')).toHaveTextContent('(empty)')
  })

  it('flags a conflicted release as will-be-skipped and shows the conflict', () => {
    const plan = buildPlan({
      totalConflicts: 1,
      hasConflicts: true,
      releases: [buildRelease({
        hasConflicts: true,
        conflicts: [{ type: 'TARGET_EXISTS', albumId: 'album-1', path: '/music/new', message: 'Target already exists' }],
      })],
    })
    render(<ChangePlanReview plan={plan} />)
    expect(screen.getByTestId('change-plan-conflict-warning')).toBeInTheDocument()
    expect(screen.getByTestId('release-skip-album-1')).toBeInTheDocument()
    expect(screen.getByTestId('conflict-badge-TARGET_EXISTS')).toHaveTextContent('Target already exists')
  })

  it('renders the releases as a semantic list', () => {
    const plan = buildPlan({ totalMoves: 1, releases: [buildRelease({
      directoryMove: { albumId: 'album-1', fromPath: 'a', toPath: 'b', mergedFromPaths: [] },
    })] })
    render(<ChangePlanReview plan={plan} />)
    expect(screen.getByRole('list', { name: /Releases in this change plan/ })).toBeInTheDocument()
  })
})
