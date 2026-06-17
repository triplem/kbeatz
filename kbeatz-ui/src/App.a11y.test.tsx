import { afterEach, beforeEach, describe, it, vi } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppThemeProvider } from './theme'
import { AlbumListPage } from './App'
import type { Album } from './api/generated'
import { expectNoA11yViolationsInBothThemes } from './test/a11y'

vi.mock('./features/albums/useAllAlbums', () => ({
  useAllAlbums: vi.fn(),
}))

import { useAllAlbums } from './features/albums/useAllAlbums'
const mockUseAllAlbums = vi.mocked(useAllAlbums)

type AllAlbumsResult = Pick<ReturnType<typeof useAllAlbums>, 'data' | 'isPending' | 'isError' | 'refetch'>

function makeAlbum(index: number): Album {
  return {
    id: `album-${index}`,
    albumArtist: `Artist ${String(index).padStart(2, '0')}`,
    album: `Album ${String(index).padStart(2, '0')}`,
    genre: index % 2 === 0 ? 'Jazz' : 'Classical',
    hasCoverArt: false,
    albumPath: `/music/album-${index}`,
  }
}

function asMock(result: AllAlbumsResult): ReturnType<typeof useAllAlbums> {
  return result as ReturnType<typeof useAllAlbums>
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      { index: true, element: <AlbumListPage /> },
      { path: '/albums/:albumId', element: <div>detail</div> },
    ],
    { initialEntries: ['/'] },
  )
  return (
    <AppThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AppThemeProvider>
  )
}

describe('AlbumListPage accessibility', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('has no WCAG 2.1 AA violations with a populated grid (both themes)', async () => {
    mockUseAllAlbums.mockReturnValue(
      asMock({
        data: Array.from({ length: 8 }, (_, i) => makeAlbum(i)),
        isPending: false,
        isError: false,
        refetch: vi.fn(),
      }),
    )
    await expectNoA11yViolationsInBothThemes(renderPage)
  })

  it('has no violations in the loading state (both themes)', async () => {
    mockUseAllAlbums.mockReturnValue(
      asMock({ data: undefined, isPending: true, isError: false, refetch: vi.fn() }),
    )
    await expectNoA11yViolationsInBothThemes(renderPage)
  })

  it('has no violations in the error state (both themes)', async () => {
    mockUseAllAlbums.mockReturnValue(
      asMock({ data: undefined, isPending: false, isError: true, refetch: vi.fn() }),
    )
    await expectNoA11yViolationsInBothThemes(renderPage)
  })

  it('has no violations in the empty state (both themes)', async () => {
    mockUseAllAlbums.mockReturnValue(
      asMock({ data: [], isPending: false, isError: false, refetch: vi.fn() }),
    )
    await expectNoA11yViolationsInBothThemes(renderPage)
  })
})
