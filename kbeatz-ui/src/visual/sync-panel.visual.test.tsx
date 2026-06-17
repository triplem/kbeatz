import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderWithProviders, THEMES } from '../test/render-helpers'
import { FIXTURE_ALBUM_DETAIL } from '../test/fixtures'

vi.mock('../api/generated', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/generated')>()
  return {
    ...actual,
    AlbumsService: { ...actual.AlbumsService, syncAlbumFromDiscogs: vi.fn() },
  }
})

import { SyncPanel } from '../features/sync/sync-panel'

/**
 * Visual-regression snapshots for the Discogs sync panel in both colour
 * schemes. Rendered in its idle state with a fixed album detail.
 */
describe('SyncPanel visual regression', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  for (const theme of THEMES) {
    it(`matches the idle sync-panel snapshot in ${theme} theme`, () => {
      const { container } = renderWithProviders(
        <SyncPanel album={FIXTURE_ALBUM_DETAIL} onSyncComplete={vi.fn()} />,
        { theme },
      )
      expect(container).toMatchSnapshot()
    })
  }
})
