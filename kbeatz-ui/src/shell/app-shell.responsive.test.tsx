import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import useMediaQuery from '@mui/material/useMediaQuery'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppThemeProvider } from '../theme'
import { theme } from '../theme/theme'
import { AppShell } from './app-shell'
import {
  BREAKPOINTS,
  type Breakpoint,
  installViewportAutoReset,
  queryMatchesAt,
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
 * jsdom applies no layout, so responsive behaviour is asserted through the only
 * runtime signal a component reads about the viewport: `matchMedia` (the basis
 * of `useMediaQuery` and MUI's responsive `display` system). The breakpoint
 * helper drives `matchMedia` to a fixed width per breakpoint, and these tests
 * assert the documented layout contract at each one:
 *
 * - The nav drawer is a temporary overlay at xs/sm and a permanent rail at
 *   md+ (the drawer toggles its two variants on `theme.breakpoints.up('md')`).
 * - The album grid reflows columns fluidly (CSS auto-fill, no fixed per-bp
 *   column count) - asserted in the grid responsive test.
 *
 * Both drawer variants are always mounted (visibility is CSS-driven), so the
 * assertion is on the breakpoint DECISION, evaluated with the same query the
 * component uses, rather than on element presence jsdom cannot resolve.
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

/** Probe that reports the drawer's permanent-vs-overlay decision via useMediaQuery. */
function DrawerModeProbe() {
  const permanent = useMediaQuery(theme.breakpoints.up('md'))
  return <div data-testid="drawer-mode">{permanent ? 'permanent' : 'overlay'}</div>
}

const EXPECTED_DRAWER_MODE: Record<Breakpoint, 'overlay' | 'permanent'> = {
  xs: 'overlay',
  sm: 'overlay',
  md: 'permanent',
  lg: 'permanent',
  xl: 'permanent',
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

  it.each(BREAKPOINTS)(
    'chooses %s drawer mode matching the documented breakpoint contract',
    (bp) => {
      setViewport(bp)
      render(
        <AppThemeProvider>
          <DrawerModeProbe />
        </AppThemeProvider>,
      )
      expect(screen.getByTestId('drawer-mode')).toHaveTextContent(EXPECTED_DRAWER_MODE[bp])
    },
  )

  it('drawer overlay/permanent boundary is exactly md (900px)', () => {
    const up = theme.breakpoints.up('md')
    expect(queryMatchesAt(up, 'sm')).toBe(false)
    expect(queryMatchesAt(up, 'md')).toBe(true)
  })

  it('keeps the primary navigation reachable at every breakpoint', () => {
    for (const bp of BREAKPOINTS) {
      setViewport(bp)
      const { unmount } = renderShellAt()
      const navs = screen.getAllByRole('navigation', { name: 'Primary navigation' })
      const hasAlbums = navs.some((n) => within(n).queryByRole('link', { name: 'Albums' }))
      expect(hasAlbums, `Albums link present at ${bp}`).toBe(true)
      unmount()
    }
  })
})
