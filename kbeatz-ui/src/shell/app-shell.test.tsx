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

  it('renders the app bar with the brand link and global controls', () => {
    renderShell()
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'kbeatz' })).toBeInTheDocument()
    // Theme toggle and language control are discoverable in the app bar (AC4).
    expect(screen.getByRole('button', { name: /switch to (light|dark) theme/i })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Select language' })).toBeInTheDocument()
  })

  it('renders the primary navigation with Albums, Library and Settings links', () => {
    renderShell()
    // Two drawer variants (permanent + temporary) render in the DOM; query the
    // permanent one which is always mounted.
    const navs = screen.getAllByRole('navigation', { name: 'Primary navigation' })
    expect(navs.length).toBeGreaterThanOrEqual(1)
    const firstNav = navs[0]
    expect(firstNav).toBeDefined()
    const nav = within(firstNav as HTMLElement)
    expect(nav.getAllByRole('link', { name: 'Albums' }).length).toBeGreaterThanOrEqual(1)
  })

  it('mounts the global scan-progress banner in the content region', () => {
    renderShell()
    expect(screen.getByTestId('scan-progress')).toBeInTheDocument()
  })

  it('renders the albums route at the index path', () => {
    renderShell(['/'])
    expect(screen.getByTestId('albums-route')).toBeInTheDocument()
  })

  it('navigates to a deep-linked route directly (bookmarkable URL)', () => {
    renderShell(['/settings'])
    expect(screen.getByTestId('settings-route')).toBeInTheDocument()
  })

  it('navigates between routes via the drawer links and updates the URL', async () => {
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
    await user.click((screen.getAllByRole('link', { name: 'Settings' }))[0] as HTMLElement)
    expect(router.state.location.pathname).toBe('/settings')

    await router.navigate(-1)
    expect(router.state.location.pathname).toBe('/')

    await router.navigate(1)
    expect(router.state.location.pathname).toBe('/settings')
  })

  it('renders a hamburger menu button for the mobile temporary drawer', () => {
    renderShell()
    // The button exists (CSS hides it at md+); clicking opens the temporary drawer.
    expect(screen.getByRole('button', { name: 'Open navigation menu' })).toBeInTheDocument()
  })

  it('opens the temporary (overlay) drawer when the menu button is clicked', async () => {
    const user = userEvent.setup()
    renderShell()
    await user.click(screen.getByRole('button', { name: 'Open navigation menu' }))
    // The temporary MUI Drawer renders a modal dialog (focus-trapped overlay).
    expect(screen.getByRole('presentation')).toBeInTheDocument()
  })

  it('exposes aria-expanded and aria-controls on the menu button (a11y)', async () => {
    const user = userEvent.setup()
    renderShell()
    const menuButton = screen.getByRole('button', { name: 'Open navigation menu' })
    expect(menuButton).toHaveAttribute('aria-expanded', 'false')
    expect(menuButton).toHaveAttribute('aria-controls', 'app-mobile-drawer')
    await user.click(menuButton)
    expect(menuButton).toHaveAttribute('aria-expanded', 'true')
  })
})
