import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoute } from '../../test/render-helpers'
import { FIXTURE_ALBUMS } from '../../test/fixtures'
import { ChangePlansService } from '../../api/generated'
import type { ChangePlan, ReleaseChangeSet } from '../../api/generated'

// Mock the data hook so the album-list page renders a fixed set of cards.
vi.mock('./useAllAlbums', () => ({
  useAllAlbums: vi.fn(),
}))

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

import { useAllAlbums } from './useAllAlbums'
import { AlbumListPage } from '../../App'

const mockUseAllAlbums = vi.mocked(useAllAlbums)
const mockCreate = vi.mocked(ChangePlansService.createChangePlan)
const mockApply = vi.mocked(ChangePlansService.applyChangePlan)

function clientResult(): ReturnType<typeof useAllAlbums> {
  return {
    data: { mode: 'client', totalElements: FIXTURE_ALBUMS.length, albums: [...FIXTURE_ALBUMS] },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useAllAlbums>
}

function buildRelease(albumId: string): ReleaseChangeSet {
  return {
    albumId,
    directoryMove: { albumId, fromPath: `/old/${albumId}`, toPath: `/new/${albumId}`, mergedFromPaths: [] },
    tagChanges: [],
    conflicts: [],
    hasConflicts: false,
  }
}

function buildPlan(albumIds: readonly string[]): ChangePlan {
  return {
    id: 'plan-1',
    operation: 'RELAYOUT',
    releases: albumIds.map(buildRelease),
    createdAt: '2026-06-20T00:00:00Z',
    totalMoves: albumIds.length,
    totalTagChanges: 0,
    totalConflicts: 0,
    hasConflicts: false,
  }
}

describe('AlbumListPage multi-select reorganize workflow', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.clearAllMocks()
    mockUseAllAlbums.mockReturnValue(clientResult())
  })

  it('selecting albums shows the bulk toolbar with the selected count', async () => {
    renderRoute([{ index: true, element: <AlbumListPage /> }])

    await userEvent.click(screen.getByTestId('album-select-checkbox-album-0001'))
    await userEvent.click(screen.getByTestId('album-select-checkbox-album-0002'))

    expect(screen.getByTestId('bulk-action-toolbar')).toBeInTheDocument()
    expect(screen.getByTestId('bulk-selected-count')).toHaveTextContent('2 albums selected')
  })

  it('reorganize drives the change-plan workflow with the selected album ids', async () => {
    mockCreate.mockResolvedValue(buildPlan(['album-0001', 'album-0002']))

    renderRoute([{ index: true, element: <AlbumListPage /> }])

    await userEvent.click(screen.getByTestId('album-select-checkbox-album-0001'))
    await userEvent.click(screen.getByTestId('album-select-checkbox-album-0002'))
    await userEvent.click(screen.getByTestId('bulk-reorganize-button'))

    await waitFor(() => expect(screen.getByTestId('bulk-relayout-workflow')).toBeInTheDocument())
    expect(mockCreate).toHaveBeenCalledWith({
      requestBody: { operation: 'RELAYOUT', albumIds: ['album-0001', 'album-0002'] },
    })
    await waitFor(() => expect(screen.getByTestId('change-plan-review')).toBeInTheDocument())
  })

  it('applying the plan shows per-release results and clears the selection', async () => {
    mockCreate.mockResolvedValue(buildPlan(['album-0001']))
    mockApply.mockResolvedValue({
      planId: 'plan-1',
      releases: [{ albumId: 'album-0001', outcome: 'APPLIED', message: null }],
      appliedCount: 1,
      skippedCount: 0,
      failedCount: 0,
    })

    renderRoute([{ index: true, element: <AlbumListPage /> }])

    await userEvent.click(screen.getByTestId('album-select-checkbox-album-0001'))
    await userEvent.click(screen.getByTestId('bulk-reorganize-button'))
    await waitFor(() => expect(screen.getByTestId('change-plan-confirm')).toBeInTheDocument())
    await userEvent.click(screen.getByTestId('change-plan-confirm'))

    await waitFor(() => expect(mockApply).toHaveBeenCalledWith({ planId: 'plan-1' }))
    // Workflow closed, toolbar gone (selection cleared on apply).
    await waitFor(() => expect(screen.queryByTestId('bulk-action-toolbar')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.queryByTestId('bulk-relayout-workflow')).not.toBeInTheDocument())
  })

  it('cancel at review closes the workflow without applying', async () => {
    mockCreate.mockResolvedValue(buildPlan(['album-0001']))

    renderRoute([{ index: true, element: <AlbumListPage /> }])

    await userEvent.click(screen.getByTestId('album-select-checkbox-album-0001'))
    await userEvent.click(screen.getByTestId('bulk-reorganize-button'))
    await waitFor(() => expect(screen.getByTestId('change-plan-cancel')).toBeInTheDocument())
    await userEvent.click(screen.getByTestId('change-plan-cancel'))

    expect(mockApply).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByTestId('bulk-relayout-workflow')).not.toBeInTheDocument())
    // Selection preserved on cancel, so the toolbar returns.
    expect(screen.getByTestId('bulk-action-toolbar')).toBeInTheDocument()
  })
})
