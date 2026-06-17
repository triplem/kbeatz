import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderRoute, THEMES } from '../test/render-helpers'
import { FIXTURE_ALBUMS } from '../test/fixtures'

// Mock the data hook so the album-list screen renders a fixed, clock-free set
// of cards. This keeps the serialized snapshot byte-stable across runs.
vi.mock('../features/albums/useAllAlbums', () => ({
  useAllAlbums: vi.fn(),
}))

import { useAllAlbums } from '../features/albums/useAllAlbums'
import { AlbumListPage } from '../App'

const mockUseAllAlbums = vi.mocked(useAllAlbums)

type Result = Pick<ReturnType<typeof useAllAlbums>, 'data' | 'isPending' | 'isError' | 'refetch'>

function asResult(overrides: Partial<Result>): ReturnType<typeof useAllAlbums> {
  return {
    data: [...FIXTURE_ALBUMS],
    isPending: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  } as ReturnType<typeof useAllAlbums>
}

/**
 * Visual-regression snapshots for the album-list screen (the app landing page)
 * in both colour schemes. Serialized-DOM snapshots, not screenshots: see
 * docs/test-strategy.md for why. Covers the populated, loading, error and empty
 * states so a markup regression in any of them is caught in either theme.
 */
describe('AlbumListPage visual regression', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.clearAllMocks()
  })

  for (const theme of THEMES) {
    it(`matches the populated-list snapshot in ${theme} theme`, () => {
      mockUseAllAlbums.mockReturnValue(asResult({ data: [...FIXTURE_ALBUMS] }))
      const { container } = renderRoute([{ index: true, element: <AlbumListPage /> }], { theme })
      expect(container).toMatchSnapshot()
    })

    it(`matches the loading snapshot in ${theme} theme`, () => {
      mockUseAllAlbums.mockReturnValue(asResult({ data: undefined, isPending: true }))
      const { container } = renderRoute([{ index: true, element: <AlbumListPage /> }], { theme })
      expect(container).toMatchSnapshot()
    })

    it(`matches the error snapshot in ${theme} theme`, () => {
      mockUseAllAlbums.mockReturnValue(asResult({ data: undefined, isError: true }))
      const { container } = renderRoute([{ index: true, element: <AlbumListPage /> }], { theme })
      expect(container).toMatchSnapshot()
    })

    it(`matches the empty snapshot in ${theme} theme`, () => {
      mockUseAllAlbums.mockReturnValue(asResult({ data: [] }))
      const { container } = renderRoute([{ index: true, element: <AlbumListPage /> }], { theme })
      expect(container).toMatchSnapshot()
    })
  }
})
