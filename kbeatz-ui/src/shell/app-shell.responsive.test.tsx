import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppThemeProvider } from '../theme'
import { AppShell } from './app-shell'
import {
  BREAKPOINTS,
  installViewportAutoReset,
  setViewport,
} from '../test/breakpoints'

// The shell mounts the global scan-progress banner; stub its data layer.
vi.mock('../features/library/scan-progress', () => ({
  ScanProgress: () => <div data-testid="scan-progress" />,
}))

/**
 * Responsive-matrix tests for the application shell across all five
 * breakpoints (xs/sm/md/lg/xl).
 *
 * There is no permanent sidebar. Desktop navigation (md+) is handled via the
 * inline TopNav links; mobile navigation (xs/sm) uses the Astryx MobileNav
 * drawer opened by the auto-hiding MobileNavToggle.
 *
 * jsdom applies no layout, so responsive behaviour is driven through
 * `matchMedia`. Both the desktop links and the mobile drawer render into the
 * DOM regardless of width (Astryx toggles visibility via CSS/JS that jsdom
 * cannot evaluate), so these tests assert the shell mounts cleanly and the
 * primary navigation stays reachable at every breakpoint.
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
    expect(
      screen.getAllByRole('navigation', { name: 'Primary navigation' }).length,
    ).toBeGreaterThanOrEqual(1)
    expect(screen.getByTestId('route-content')).toBeInTheDocument()
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

  it('exposes the desktop nav links in the TopNav landmark', () => {
    setViewport('md')
    renderShellAt()
    // The TopNav renders a <nav aria-label="Primary navigation"> with the
    // desktop links; getAllByRole covers both it and the mobile drawer.
    const navs = screen.getAllByRole('navigation', { name: 'Primary navigation' })
    expect(navs.length).toBeGreaterThanOrEqual(1)
    const hasDesktopLinks = navs.some((n) => within(n).queryByRole('link', { name: 'Albums' }))
    expect(hasDesktopLinks).toBe(true)
  })
})
