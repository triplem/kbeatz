import { describe, it, vi, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppThemeProvider } from '../../theme'
import { SyncPanel } from './sync-panel'
import type { AlbumDetail } from '../../api/generated'
import { expectNoA11yViolationsInBothThemes } from '../../test/a11y'

vi.mock('../../api/generated', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/generated')>()
  return {
    ...actual,
    AlbumsService: { ...actual.AlbumsService, syncAlbumFromDiscogs: vi.fn() },
  }
})

function buildAlbumDetail(overrides: Partial<AlbumDetail> = {}): AlbumDetail {
  return {
    id: 'test-album-id',
    albumArtist: 'Miles Davis',
    album: 'Kind of Blue',
    albumPath: 'Jazz/Miles Davis/Kind of Blue',
    hasCoverArt: false,
    discogsId: '12345',
    tracks: [],
    ...overrides,
  }
}

function panel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return (
    <AppThemeProvider>
      <QueryClientProvider client={queryClient}>
        <SyncPanel album={buildAlbumDetail()} onSyncComplete={vi.fn()} />
      </QueryClientProvider>
    </AppThemeProvider>
  )
}

describe('SyncPanel accessibility', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('has no WCAG 2.1 AA violations (both themes)', async () => {
    await expectNoA11yViolationsInBothThemes(panel)
  })
})
