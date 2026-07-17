import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppThemeProvider } from '../theme'
import { AppShell } from './app-shell'
import { expectNoA11yViolationsInBothThemes } from '../test/a11y'

// Keep the shell test focused on shell/routing; the scan banner data layer is
// stubbed so it does not poll the network.
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

function shell() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      {
        element: <AppShell />,
        children: [{ index: true, element: <div data-testid="albums-route">Albums</div> }],
      },
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

describe('AppShell accessibility', () => {
  beforeEach(() => {
    window.localStorage.clear()
    stubMatchMedia()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('has no WCAG 2.1 AA violations (both themes)', async () => {
    await expectNoA11yViolationsInBothThemes(shell)
  })

  it('exposes a keyboard-reachable skip link targeting the main region', async () => {
    const user = userEvent.setup()
    render(shell())
    const skip = screen.getByTestId('skip-to-content')
    // Astryx AppShell wires the skip link to its own main region id.
    const href = skip.getAttribute('href') ?? ''
    expect(href).toMatch(/^#/)
    // The skip link is the first thing reached by Tab from the document start.
    await user.tab()
    expect(skip).toHaveFocus()
    // The skip target exists and the routed content region is a main landmark.
    expect(document.getElementById(href.slice(1))).not.toBeNull()
    expect(screen.getByRole('main')).toBeInTheDocument()
  })
})
