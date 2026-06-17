import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppThemeProvider, COLOR_SCHEME_ATTR } from '../theme'
import { AppShell } from './app-shell'

vi.mock('../features/library/scan-progress', () => ({
  ScanProgress: () => <div data-testid="scan-progress" />,
}))

function stubMatchMedia(prefersDark: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: prefersDark,
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

/**
 * Simulate a private-mode browser where localStorage access throws (AC7).
 * Every getItem/setItem call raises, so the theme layer must fall back to
 * in-memory defaults and the OS colour scheme, and the shell must still load.
 */
function breakLocalStorage(): void {
  const throwingStorage = {
    getItem: () => {
      throw new DOMException('localStorage disabled', 'SecurityError')
    },
    setItem: () => {
      throw new DOMException('localStorage disabled', 'SecurityError')
    },
    removeItem: () => {
      throw new DOMException('localStorage disabled', 'SecurityError')
    },
    clear: () => undefined,
    key: () => null,
    length: 0,
  }
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: throwingStorage,
  })
}

function renderApp() {
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
  return render(
    <AppThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AppThemeProvider>,
  )
}

describe('AppShell - localStorage unavailable (private mode)', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute(COLOR_SCHEME_ATTR)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    // Restore a working localStorage for subsequent suites.
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: Object.create(Storage.prototype),
    })
  })

  it('still loads the shell and content when localStorage throws', () => {
    breakLocalStorage()
    stubMatchMedia(false)
    expect(() => renderApp()).not.toThrow()
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByTestId('albums-route')).toBeInTheDocument()
  })

  it('falls back to the OS dark theme when storage is unavailable and OS prefers dark', () => {
    breakLocalStorage()
    stubMatchMedia(true)
    renderApp()
    expect(document.documentElement.getAttribute(COLOR_SCHEME_ATTR)).toBe('dark')
  })

  it('falls back to the OS light theme when storage is unavailable and OS prefers light', () => {
    breakLocalStorage()
    stubMatchMedia(false)
    renderApp()
    expect(document.documentElement.getAttribute(COLOR_SCHEME_ATTR)).toBe('light')
  })
})
