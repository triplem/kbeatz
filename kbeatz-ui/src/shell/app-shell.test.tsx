import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppThemeProvider } from '../theme'
import { AppShell } from './app-shell'

// ---------------------------------------------------------------------------
// Module mocks - keep the shell test focused on shell/routing concerns.
// ScanProgress is mounted globally by the shell; stub the data layer so it is
// inert and does not perform network polling during the test.
// ---------------------------------------------------------------------------

vi.mock('../features/library/scan-progress', () => ({
  ScanProgress: () => <div data-testid="scan-progress" />,
}))

function stubMatchMedia(): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: false,
      media: '',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  )
}

function renderShell(initialEntries: string[] = ['/']) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const router = createMemoryRouter(
    [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <div data-testid="albums-route">Albums</div> },
          { path: '/library', element: <div data-testid="library-route">Library</div> },
          { path: '/settings', element: <div data-testid="settings-route">Settings</div> },
        ],
      },
    ],
    { initialEntries },
  )
  return {
    router,
    ...render(
      <AppThemeProvider>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </AppThemeProvider>,
    ),
  }
}

describe('AppShell', () => {
  beforeEach(() => {
    stubMatchMedia()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the top navigation with the brand link and global controls', () => {
    renderShell()
    // The primary navigation landmark carries the brand link plus the global
    // theme and language controls (AC4).
    expect(
      screen.getAllByRole('navigation', { name: 'Primary navigation' }).length,
    ).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByRole('link', { name: 'kbeatz' }).length).toBeGreaterThanOrEqual(1)
    expect(
      screen.getByRole('button', { name: /switch to (light|dark) theme/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Select language' })).toBeInTheDocument()
  })

  it('renders the primary navigation with Albums, Library and Settings links', () => {
    renderShell()
    for (const label of ['Albums', 'Library', 'Settings']) {
      expect(screen.getAllByRole('link', { name: label }).length).toBeGreaterThanOrEqual(1)
    }
  })

  it('marks the active destination with aria-current=page', () => {
    renderShell(['/library'])
    const libraryLinks = screen.getAllByRole('link', { name: 'Library' })
    expect(libraryLinks.some((l) => l.getAttribute('aria-current') === 'page')).toBe(true)
  })

  it('exposes a skip-to-content link', () => {
    renderShell()
    expect(screen.getByTestId('skip-to-content')).toBeInTheDocument()
  })

  it('mounts the global scan-progress banner in the content region', () => {
    renderShell()
    const main = screen.getByRole('main')
    expect(within(main).getByTestId('scan-progress')).toBeInTheDocument()
  })

  it('renders the albums route at the index path', () => {
    renderShell(['/'])
    expect(screen.getByTestId('albums-route')).toBeInTheDocument()
  })

  it('navigates to a deep-linked route directly (bookmarkable URL)', () => {
    renderShell(['/settings'])
    expect(screen.getByTestId('settings-route')).toBeInTheDocument()
  })

  it('navigates between routes via the nav links and updates the URL', async () => {
    const user = userEvent.setup()
    const { router } = renderShell(['/'])
    const libraryLinks = screen.getAllByRole('link', { name: 'Library' })
    await user.click(libraryLinks[0] as HTMLElement)
    expect(screen.getByTestId('library-route')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/library')
  })

  it('supports browser back/forward navigation', async () => {
    const user = userEvent.setup()
    const { router } = renderShell(['/'])
    await user.click(screen.getAllByRole('link', { name: 'Settings' })[0] as HTMLElement)
    expect(router.state.location.pathname).toBe('/settings')

    await router.navigate(-1)
    expect(router.state.location.pathname).toBe('/')

    await router.navigate(1)
    expect(router.state.location.pathname).toBe('/settings')
  })
})
