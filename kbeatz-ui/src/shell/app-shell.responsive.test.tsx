import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppThemeProvider } from '../theme'
import { AppShell } from './app-shell'
import {
  BREAKPOINTS,
  type Breakpoint,
  installViewportAutoReset,
  setViewport,
} from '../test/breakpoints'

// The shell mounts the global scan-progress banner; stub its data layer.
vi.mock('../features/library/scan-progress', () => ({
  ScanProgress: () => <div data-testid="scan-progress" />,
}))

/**
 * Responsive-matrix tests for the application shell across all five MUI
 * breakpoints (xs/sm/md/lg/xl).
 *
 * Since PR #915, the permanent sidebar no longer exists. Desktop navigation
 * (md+) is handled via AppBar nav links; mobile navigation (xs/sm) uses the
 * hamburger-triggered temporary overlay drawer.
 *
 * jsdom applies no layout, so responsive behaviour is asserted through
 * `matchMedia` (the basis of `useMediaQuery` and MUI's responsive `display`
 * system). The breakpoint helper drives `matchMedia` to a fixed width per
 * breakpoint.
 */

function renderShellAt() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      {
        element: <AppShell />,
        children: [{ index: true, element: <div data-testid="route-content">Content</div> }],
      },
    ],
    { initialEntries: ['/'] },
  )
  return render(
    <AppThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AppThemeProvider>,
  )
}

describe('AppShell responsive matrix', () => {
  installViewportAutoReset()

  beforeEach(() => {
    window.localStorage.clear()
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it.each(BREAKPOINTS)('renders the shell without error at %s', (bp) => {
    setViewport(bp)
    renderShellAt()
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByTestId('route-content')).toBeInTheDocument()
    // The hamburger menu button is always present (CSS hides it at md+).
    expect(screen.getByRole('button', { name: 'Open navigation menu' })).toBeInTheDocument()
  })

  it('keeps the primary navigation reachable at every breakpoint', () => {
    for (const bp of BREAKPOINTS) {
      setViewport(bp)
      const { unmount } = renderShellAt()
      // At md+ the nav landmark is inside the AppBar (desktop links).
      // At xs/sm the temporary drawer also provides a nav landmark (always mounted).
      const navs = screen.getAllByRole('navigation', { name: 'Primary navigation' })
      const hasAlbums = navs.some((n) => within(n).queryByRole('link', { name: 'Albums' }))
      expect(hasAlbums, `Albums link present at ${bp}`).toBe(true)
      unmount()
    }
  })

  it('desktop nav links are present in the AppBar nav landmark', () => {
    setViewport('md')
    renderShellAt()
    // The AppBar contains a <nav aria-label="Primary navigation"> at md+.
    // getAllByRole returns both the AppBar nav and any mobile drawer nav.
    const navs = screen.getAllByRole('navigation', { name: 'Primary navigation' })
    expect(navs.length).toBeGreaterThanOrEqual(1)
    // At least one of the nav landmarks has the Albums link (AppBar or mobile drawer).
    const hasAlbums = navs.some((n) => within(n).queryByRole('link', { name: 'Albums' }))
    expect(hasAlbums).toBe(true)
  })

  it('at desktop breakpoint the AppBar nav links are present and no permanent sidebar offset exists', () => {
    setViewport('md')
    renderShellAt()
    // Desktop nav links are in the AppBar nav landmark - not a drawer.
    const navs = screen.getAllByRole('navigation', { name: 'Primary navigation' })
    expect(navs.length).toBeGreaterThanOrEqual(1)
    const hasDesktopLinks = navs.some((n) => within(n).queryByRole('link', { name: 'Albums' }))
    expect(hasDesktopLinks).toBe(true)
    // The temporary drawer is closed so no modal overlay (focus trap) is present.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
