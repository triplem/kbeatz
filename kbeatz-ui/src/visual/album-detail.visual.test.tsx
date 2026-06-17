import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderRoute, THEMES } from '../test/render-helpers'
import { FIXTURE_ALBUM_DETAIL } from '../test/fixtures'

vi.mock('../api/generated', () => ({
  AlbumsService: {
    getAlbum: vi.fn(),
    updateAlbumTags: vi.fn(),
    updateTrackTags: vi.fn(),
    bulkUpdateAlbumTags: vi.fn(),
    syncAlbumFromDiscogs: vi.fn(),
  },
}))

// Stub the sync panel so the detail snapshot is not coupled to the sync data
// layer; the sync panel has its own visual snapshot.
vi.mock('../features/sync/sync-panel', () => ({
  SyncPanel: () => <div data-testid="sync-panel" />,
}))

import { AlbumsService } from '../api/generated'
import { AlbumDetail } from '../features/albums/album-detail'

const mockGetAlbum = vi.mocked(AlbumsService.getAlbum)

function detailRoutes() {
  return [
    { path: '/', element: <div>list</div> },
    { path: '/albums/:albumId', element: <AlbumDetail /> },
  ]
}

/**
 * Visual-regression snapshots for the album-detail screen in both colour
 * schemes. The album loads asynchronously, so the test awaits the h1 heading
 * before serialising. Fixed fixture data (stable id, no clock) keeps the
 * snapshot deterministic.
 */
describe('AlbumDetail visual regression', () => {
  beforeEach(() => {
    window.localStorage.clear()
    mockGetAlbum.mockResolvedValue(FIXTURE_ALBUM_DETAIL)
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  for (const theme of THEMES) {
    it(`matches the loaded-detail snapshot in ${theme} theme`, async () => {
      const { container } = renderRoute(detailRoutes(), {
        theme,
        initialEntries: ['/', '/albums/album-0001'],
        initialIndex: 1,
      })
      await screen.findByRole('heading', { level: 1, name: 'Kind of Blue' })
      expect(container).toMatchSnapshot()
    })
  }
})
