import { type ReactElement, type ReactNode } from 'react'
import { render, type RenderResult } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppThemeProvider } from '../theme'
import { COLOR_SCHEME_ATTR, THEME_STORAGE_KEY, type ColorScheme } from '../theme/theme'

/**
 * Shared render helpers for the visual-regression, responsive-matrix, and
 * behaviour suites. Centralised here so every screen is mounted through one
 * provider stack (theme + query + router), which keeps snapshots and behaviour
 * tests comparable across screens and avoids the per-file provider boilerplate
 * that drifts over time (architect: one wrapper, not N copies).
 */

export const THEMES = ['light', 'dark'] as const

/**
 * Force the active MUI colour scheme before mounting by seeding the persisted
 * key the ColorSchemeProvider reads on its first render AND setting the root
 * attribute the CSS-variable theme selects on. Mirrors the a11y helper so a
 * snapshot taken in "dark" really reflects the dark scheme.
 */
export function applyTheme(theme: ColorScheme): void {
  window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  document.documentElement.setAttribute(COLOR_SCHEME_ATTR, theme)
}

/** A QueryClient with retries and background refetch disabled for determinism. */
export function makeTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  })
}

interface ProvidersProps {
  readonly children: ReactNode
  readonly queryClient?: QueryClient
}

/** Theme + Query providers without a router (for components that bring their own). */
export function Providers({ children, queryClient }: ProvidersProps): ReactElement {
  const client = queryClient ?? makeTestQueryClient()
  return (
    <AppThemeProvider>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </AppThemeProvider>
  )
}

export interface RenderWithProvidersOptions {
  /** Colour scheme to seed before mount. Defaults to leaving the current value. */
  readonly theme?: ColorScheme
  /** Reuse an existing client (e.g. to seed cache); a fresh one is made otherwise. */
  readonly queryClient?: QueryClient
}

/**
 * Render a self-contained element (one that supplies its own router, or needs
 * none) inside the theme + query providers.
 */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
): RenderResult {
  if (options.theme) {
    applyTheme(options.theme)
  }
  return render(<Providers queryClient={options.queryClient}>{ui}</Providers>)
}

export interface RenderRouteOptions extends RenderWithProvidersOptions {
  readonly initialEntries?: string[]
  readonly initialIndex?: number
}

export interface RenderRouteResult extends RenderResult {
  readonly router: ReturnType<typeof createMemoryRouter>
}

/**
 * Render a set of routes inside a MemoryRouter wrapped in the provider stack.
 * Returns the router so behaviour tests can assert/drive navigation
 * (back/forward, deep links) deterministically.
 */
export function renderRoute(
  routes: RouteObject[],
  options: RenderRouteOptions = {},
): RenderRouteResult {
  if (options.theme) {
    applyTheme(options.theme)
  }
  const client = options.queryClient ?? makeTestQueryClient()
  const router = createMemoryRouter(routes, {
    initialEntries: options.initialEntries ?? ['/'],
    ...(options.initialIndex !== undefined ? { initialIndex: options.initialIndex } : {}),
  })
  const result = render(
    <AppThemeProvider>
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AppThemeProvider>,
  )
  return { ...result, router }
}
