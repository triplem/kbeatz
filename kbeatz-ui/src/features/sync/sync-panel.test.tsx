import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SyncPanel } from './sync-panel'
import { AlbumsService, ChangePlansService } from '../../api/generated'
import type {
  Album,
  AlbumDetail,
  ApplyChangePlanResult,
  ChangePlan,
  ReleaseChangeSet,
} from '../../api/generated'

vi.mock('../../api/generated', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/generated')>()
  return {
    ...actual,
    AlbumsService: {
      ...actual.AlbumsService,
      getAlbum: vi.fn(),
    },
    ChangePlansService: {
      ...actual.ChangePlansService,
      createChangePlan: vi.fn(),
      applyChangePlan: vi.fn(),
    },
  }
})

const mockGetAlbum = vi.mocked(AlbumsService.getAlbum)
const mockCreatePlan = vi.mocked(ChangePlansService.createChangePlan)
const mockApplyPlan = vi.mocked(ChangePlansService.applyChangePlan)

const ALBUM_ID = 'test-album-id'

function buildAlbum(overrides: Partial<Album> = {}): Album {
  return {
    id: ALBUM_ID,
    albumArtist: 'Miles Davis',
    album: 'Kind of Blue',
    albumPath: 'Jazz/Miles Davis/Kind of Blue',
    hasCoverArt: false,
    discogsId: '12345',
    ...overrides,
  }
}

function buildAlbumDetail(overrides: Partial<AlbumDetail> = {}): AlbumDetail {
  return {
    id: ALBUM_ID,
    albumArtist: 'Miles Davis',
    album: 'Kind of Blue',
    albumPath: 'Jazz/Miles Davis/Kind of Blue',
    hasCoverArt: false,
    discogsId: '12345',
    tracks: [],
    ...overrides,
  }
}

function buildRelease(overrides: Partial<ReleaseChangeSet> = {}): ReleaseChangeSet {
  return {
    albumId: ALBUM_ID,
    directoryMove: null,
    tagChanges: [],
    conflicts: [],
    hasConflicts: false,
    ...overrides,
  }
}

function buildPlan(overrides: Partial<ChangePlan> = {}): ChangePlan {
  const releases = overrides.releases ?? [buildRelease()]
  return {
    id: 'plan-1',
    operation: 'DISCOGS_SYNC',
    releases,
    createdAt: '2026-06-20T00:00:00Z',
    totalMoves: 0,
    totalTagChanges: 0,
    totalConflicts: 0,
    hasConflicts: false,
    ...overrides,
  }
}

function buildApplyResult(overrides: Partial<ApplyChangePlanResult> = {}): ApplyChangePlanResult {
  return {
    planId: 'plan-1',
    releases: [{ albumId: ALBUM_ID, outcome: 'APPLIED', message: null }],
    appliedCount: 1,
    skippedCount: 0,
    failedCount: 0,
    ...overrides,
  }
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

function renderSyncPanel(props: {
  album: AlbumDetail
  onSyncComplete: (a: Album) => void
  hasLocalEdits?: boolean
}) {
  const queryClient = makeQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <SyncPanel {...props} />
    </QueryClientProvider>,
  )
}

/** Click sync, wait for the review to render, then confirm the apply. */
async function clickSyncAndConfirm() {
  const user = userEvent.setup()
  await user.click(screen.getByTestId('sync-button'))
  await waitFor(() => expect(screen.getByTestId('sync-review-confirm')).toBeEnabled())
  await user.click(screen.getByTestId('sync-review-confirm'))
}

describe('SyncPanel', () => {
  const onSyncComplete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    // Default: a no-change dry-run plan and an applied result.
    mockCreatePlan.mockResolvedValue(buildPlan())
    mockApplyPlan.mockResolvedValue(buildApplyResult())
    mockGetAlbum.mockResolvedValue(buildAlbumDetail())
  })

  // ---- visibility ----

  it('should not render when album has no discogsId', () => {
    const album = buildAlbumDetail({ discogsId: undefined })
    const { container } = renderSyncPanel({ album, onSyncComplete })
    expect(container.firstChild).toBeNull()
  })

  it('should render sync panel when album has a discogsId', () => {
    renderSyncPanel({ album: buildAlbumDetail(), onSyncComplete })
    expect(screen.getByTestId('sync-button')).toBeInTheDocument()
    expect(screen.getByTestId('discogs-id')).toHaveTextContent('12345')
  })

  it('should show "Also update cover art" checkbox unchecked by default', () => {
    renderSyncPanel({ album: buildAlbumDetail(), onSyncComplete })
    expect(screen.getByTestId('download-images-checkbox')).not.toBeChecked()
  })

  // ---- dry-run review flow ----

  it('should request a DISCOGS_SYNC dry-run plan when sync is clicked', async () => {
    renderSyncPanel({ album: buildAlbumDetail(), onSyncComplete })
    await userEvent.click(screen.getByTestId('sync-button'))

    await waitFor(() => expect(screen.getByTestId('sync-review')).toBeInTheDocument())
    expect(mockCreatePlan).toHaveBeenCalledWith({
      requestBody: { operation: 'DISCOGS_SYNC', albumIds: [ALBUM_ID] },
    })
    // Apply must NOT have been called yet (dry run only).
    expect(mockApplyPlan).not.toHaveBeenCalled()
  })

  it('should render the change-plan review with tag diffs', async () => {
    mockCreatePlan.mockResolvedValue(buildPlan({
      totalTagChanges: 1,
      releases: [buildRelease({
        tagChanges: [{ targetPath: ALBUM_ID, field: 'GENRE', currentValue: 'Jazz', proposedValue: 'Modal Jazz' }],
      })],
    }))

    renderSyncPanel({ album: buildAlbumDetail(), onSyncComplete })
    await userEvent.click(screen.getByTestId('sync-button'))

    await waitFor(() => expect(screen.getByTestId('change-plan-review')).toBeInTheDocument())
    expect(screen.getByTestId('tag-diff-row-GENRE')).toBeInTheDocument()
    expect(screen.getByTestId('total-tag-changes')).toHaveTextContent('1 tag change')
  })

  it('cancel at review writes nothing and closes', async () => {
    renderSyncPanel({ album: buildAlbumDetail(), onSyncComplete })
    await userEvent.click(screen.getByTestId('sync-button'))

    await waitFor(() => expect(screen.getByTestId('sync-review')).toBeInTheDocument())
    await userEvent.click(screen.getByTestId('sync-review-cancel'))

    expect(screen.queryByTestId('sync-review')).not.toBeInTheDocument()
    expect(mockApplyPlan).not.toHaveBeenCalled()
  })

  it('should show loading state while the dry-run plan is in flight', async () => {
    let resolve: (v: ChangePlan) => void = () => {}
    mockCreatePlan.mockReturnValue(
      new Promise((r) => { resolve = r }) as ReturnType<typeof mockCreatePlan>,
    )

    renderSyncPanel({ album: buildAlbumDetail(), onSyncComplete })
    await userEvent.click(screen.getByTestId('sync-button'))

    await waitFor(() => expect(screen.getByTestId('sync-review-loading')).toBeInTheDocument())
    expect(screen.getByTestId('sync-button')).toBeDisabled()

    resolve(buildPlan())
    await waitFor(() => expect(screen.queryByTestId('sync-review-loading')).not.toBeInTheDocument())
  })

  it('should show an error with retry when the dry-run plan fails', async () => {
    mockCreatePlan.mockRejectedValue({ body: { message: 'Discogs unavailable' } })

    renderSyncPanel({ album: buildAlbumDetail(), onSyncComplete })
    await userEvent.click(screen.getByTestId('sync-button'))

    await waitFor(() => expect(screen.getByTestId('sync-review-error')).toBeInTheDocument())
    expect(mockApplyPlan).not.toHaveBeenCalled()
  })

  // ---- apply flow ----

  it('should apply the plan when the user confirms the review', async () => {
    renderSyncPanel({ album: buildAlbumDetail(), onSyncComplete })
    await clickSyncAndConfirm()

    await waitFor(() => expect(mockApplyPlan).toHaveBeenCalledWith({ planId: 'plan-1' }))
  })

  it('should show success and call onSyncComplete after apply', async () => {
    const updated = buildAlbum({ album: 'Kind of Blue (updated)' })
    mockGetAlbum.mockResolvedValue({ ...buildAlbumDetail(), album: 'Kind of Blue (updated)' })

    renderSyncPanel({ album: buildAlbumDetail(), onSyncComplete })
    await clickSyncAndConfirm()

    await waitFor(() => expect(screen.getByTestId('sync-success')).toBeInTheDocument())
    expect(onSyncComplete).toHaveBeenCalledWith(expect.objectContaining({ id: updated.id }))
  })

  it('should announce the number of tag fields written', async () => {
    mockCreatePlan.mockResolvedValue(buildPlan({
      totalTagChanges: 2,
      releases: [buildRelease({
        tagChanges: [
          { targetPath: ALBUM_ID, field: 'GENRE', currentValue: null, proposedValue: 'Jazz' },
          { targetPath: ALBUM_ID, field: 'DATE', currentValue: null, proposedValue: '1959' },
        ],
      })],
    }))

    renderSyncPanel({ album: buildAlbumDetail(), onSyncComplete })
    await clickSyncAndConfirm()

    await waitFor(() => expect(screen.getByTestId('sync-success')).toBeInTheDocument())
    expect(screen.getByTestId('sync-success')).toHaveTextContent('2 fields updated')
  })

  it('should show singular field text when exactly one tag changed', async () => {
    mockCreatePlan.mockResolvedValue(buildPlan({
      totalTagChanges: 1,
      releases: [buildRelease({
        tagChanges: [{ targetPath: ALBUM_ID, field: 'GENRE', currentValue: null, proposedValue: 'Jazz' }],
      })],
    }))

    renderSyncPanel({ album: buildAlbumDetail(), onSyncComplete })
    await clickSyncAndConfirm()

    await waitFor(() => expect(screen.getByTestId('sync-success')).toBeInTheDocument())
    expect(screen.getByTestId('sync-success')).toHaveTextContent('1 field updated')
    expect(screen.getByTestId('sync-success')).not.toHaveTextContent('1 fields')
  })

  it('should dismiss the success snackbar when its close button is clicked', async () => {
    const user = userEvent.setup()
    renderSyncPanel({ album: buildAlbumDetail(), onSyncComplete })
    await user.click(screen.getByTestId('sync-button'))
    await waitFor(() => expect(screen.getByTestId('sync-review-confirm')).toBeEnabled())
    await user.click(screen.getByTestId('sync-review-confirm'))

    await waitFor(() => expect(screen.getByTestId('sync-success')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByTestId('sync-success')).not.toBeInTheDocument())
  })

  // ---- error / outcome handling ----

  it('should show error when apply rejects', async () => {
    mockApplyPlan.mockRejectedValue({
      body: { code: 'SYNC_FAILED', message: 'Discogs API unavailable. Please try again later.' },
    })

    renderSyncPanel({ album: buildAlbumDetail(), onSyncComplete })
    await clickSyncAndConfirm()

    await waitFor(() => expect(screen.getByTestId('sync-error')).toBeInTheDocument())
    expect(screen.getByTestId('sync-error')).toHaveTextContent('Discogs API unavailable')
  })

  it('should show error when the release outcome is FAILED', async () => {
    mockApplyPlan.mockResolvedValue(buildApplyResult({
      releases: [{ albumId: ALBUM_ID, outcome: 'FAILED', message: 'Write failed on disk' }],
      appliedCount: 0,
      failedCount: 1,
    }))

    renderSyncPanel({ album: buildAlbumDetail(), onSyncComplete })
    await clickSyncAndConfirm()

    await waitFor(() => expect(screen.getByTestId('sync-error')).toBeInTheDocument())
    expect(screen.getByTestId('sync-error')).toHaveTextContent('Write failed on disk')
    expect(onSyncComplete).not.toHaveBeenCalled()
  })

  // ---- quota exhausted ----

  it('should show quota exhausted message with reset time', async () => {
    mockApplyPlan.mockRejectedValue({
      body: {
        code: 'IMAGE_QUOTA_EXHAUSTED',
        message: 'Daily image quota exhausted',
        details: ['resetAt=2026-06-08T00:00:00Z'],
      },
    })

    const user = userEvent.setup()
    renderSyncPanel({ album: buildAlbumDetail(), onSyncComplete })
    await user.click(screen.getByTestId('download-images-checkbox'))
    await user.click(screen.getByTestId('sync-button'))
    await waitFor(() => expect(screen.getByTestId('sync-review-confirm')).toBeEnabled())
    await user.click(screen.getByTestId('sync-review-confirm'))

    await waitFor(() => expect(screen.getByTestId('sync-quota-exhausted')).toBeInTheDocument())
    expect(screen.getByTestId('sync-quota-exhausted')).toHaveTextContent('2026-06-08T00:00:00Z')
  })

  // ---- accessibility ----

  it('sync button is keyboard-accessible (findable by role and label)', () => {
    renderSyncPanel({ album: buildAlbumDetail(), onSyncComplete })
    expect(screen.getByRole('button', { name: 'Sync from Discogs' })).toBeInTheDocument()
  })

  it('download cover art checkbox is keyboard-accessible', () => {
    renderSyncPanel({ album: buildAlbumDetail(), onSyncComplete })
    expect(screen.getByRole('checkbox', { name: 'Download cover art' })).toBeInTheDocument()
  })

  it('success message has role=status and aria-live=polite', async () => {
    renderSyncPanel({ album: buildAlbumDetail(), onSyncComplete })
    await clickSyncAndConfirm()

    await waitFor(() => {
      const statusEl = screen.getByTestId('sync-success')
      expect(statusEl).toHaveAttribute('role', 'status')
      expect(statusEl).toHaveAttribute('aria-live', 'polite')
    })
  })

  it('error message has role=alert for immediate announcement', async () => {
    mockApplyPlan.mockRejectedValue({ body: { message: 'Server error' } })

    renderSyncPanel({ album: buildAlbumDetail(), onSyncComplete })
    await clickSyncAndConfirm()

    await waitFor(() => {
      expect(screen.getByTestId('sync-error')).toHaveAttribute('role', 'alert')
    })
  })

  // ---- overwrite warning (#392) ----

  it('sync proceeds straight to review when hasLocalEdits is false', async () => {
    renderSyncPanel({ album: buildAlbumDetail(), onSyncComplete, hasLocalEdits: false })
    await userEvent.click(screen.getByTestId('sync-button'))

    expect(screen.queryByTestId('sync-overwrite-dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('sync-review')).toBeInTheDocument())
    expect(mockApplyPlan).not.toHaveBeenCalled()
  })

  it('shows overwrite warning dialog when hasLocalEdits is true', async () => {
    renderSyncPanel({ album: buildAlbumDetail(), onSyncComplete, hasLocalEdits: true })
    await userEvent.click(screen.getByTestId('sync-button'))

    expect(screen.getByTestId('sync-overwrite-dialog')).toBeInTheDocument()
    expect(screen.getByTestId('sync-overwrite-dialog')).toHaveAttribute('role', 'dialog')
    expect(mockCreatePlan).not.toHaveBeenCalled()
  })

  it('aborts sync when user cancels the overwrite warning', async () => {
    renderSyncPanel({ album: buildAlbumDetail(), onSyncComplete, hasLocalEdits: true })
    await userEvent.click(screen.getByTestId('sync-button'))

    await userEvent.click(screen.getByTestId('sync-overwrite-dialog-cancel'))

    expect(screen.queryByTestId('sync-overwrite-dialog')).not.toBeInTheDocument()
    expect(mockCreatePlan).not.toHaveBeenCalled()
    expect(mockApplyPlan).not.toHaveBeenCalled()
  })

  it('proceeds to review when user confirms the overwrite warning', async () => {
    renderSyncPanel({ album: buildAlbumDetail(), onSyncComplete, hasLocalEdits: true })
    await userEvent.click(screen.getByTestId('sync-button'))

    await userEvent.click(screen.getByTestId('sync-overwrite-dialog-confirm'))

    expect(screen.queryByTestId('sync-overwrite-dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('sync-review')).toBeInTheDocument())
    expect(mockCreatePlan).toHaveBeenCalled()
    expect(mockApplyPlan).not.toHaveBeenCalled()
  })

  it('applies the plan when review is confirmed after the overwrite warning', async () => {
    const user = userEvent.setup()
    renderSyncPanel({ album: buildAlbumDetail(), onSyncComplete, hasLocalEdits: true })

    await user.click(screen.getByTestId('sync-button'))
    await user.click(screen.getByTestId('sync-overwrite-dialog-confirm'))
    await waitFor(() => expect(screen.getByTestId('sync-review-confirm')).toBeEnabled())
    await user.click(screen.getByTestId('sync-review-confirm'))

    await waitFor(() => expect(mockApplyPlan).toHaveBeenCalled())
  })
})
