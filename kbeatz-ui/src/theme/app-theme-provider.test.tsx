import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppThemeProvider, useColorScheme } from './app-theme-provider'
import { sanitizePersistedColorScheme } from './theme-storage'
import { COLOR_SCHEME_ATTR, THEME_STORAGE_KEY } from './theme'

// Debug component exposing the resolved color scheme from our own context.
function DebugColorScheme() {
  const { colorScheme } = useColorScheme()
  return <div data-testid="debug" data-scheme={colorScheme} />
}

// AppThemeProvider mounts a LinkProvider whose adapter uses react-router's Link,
// so the provider must render inside a router in tests.
function renderInProvider(children: ReactNode) {
  return render(
    <MemoryRouter>
      <AppThemeProvider>{children}</AppThemeProvider>
    </MemoryRouter>,
  )
}

/**
 * Stub window.matchMedia to report a given `prefers-color-scheme: dark` result
 * so the OS preference can be simulated deterministically in jsdom (which never
 * fires real `change` events).
 */
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

describe('AppThemeProvider', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.removeAttribute(COLOR_SCHEME_ATTR)
    stubMatchMedia(false)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should render children inside the theme + color-scheme context', () => {
    renderInProvider(<span>app body</span>)
    expect(screen.getByText('app body')).toBeInTheDocument()
  })

  it('should expose light color scheme when no preference is stored and OS is light', () => {
    renderInProvider(<DebugColorScheme />)
    const debug = screen.getByTestId('debug')
    expect(debug.getAttribute('data-scheme')).toBe('light')
    // The resolved scheme is mirrored to the root attribute.
    expect(document.documentElement.getAttribute(COLOR_SCHEME_ATTR)).toBe('light')
  })
})

/**
 * Edge-case coverage for this project's color-scheme resolution. Unlike MUI's
 * persistent 'system' mode, AppThemeProvider resolves the OS preference into an
 * explicit 'light'/'dark' at load (resolveInitialColorScheme) and mirrors it to
 * the root attribute. Corrupt persisted values are removed by
 * sanitizePersistedColorScheme() before the provider mounts (mirrors main.tsx),
 * so the corrupt path and the fresh path must agree.
 */
describe('AppThemeProvider color-scheme edge cases', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.removeAttribute(COLOR_SCHEME_ATTR)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function renderDebug() {
    sanitizePersistedColorScheme()
    renderInProvider(<DebugColorScheme />)
    return screen.getByTestId('debug')
  }

  it('should sanitise a corrupt stored value and fall back to the OS scheme (light)', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'corrupt')
    stubMatchMedia(false) // OS = light

    const debug = renderDebug()

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
    expect(debug.getAttribute('data-scheme')).toBe('light')
  })

  it('should resolve a corrupt value to the OS scheme regardless of OS preference (dark)', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'corrupt')
    stubMatchMedia(true) // OS = dark

    const debug = renderDebug()

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
    expect(debug.getAttribute('data-scheme')).toBe('dark')
  })

  it('should resolve a corrupt value the SAME way as a fresh load (bootstrap equivalence)', () => {
    stubMatchMedia(true) // OS = dark

    // Fresh load: nothing persisted.
    window.localStorage.clear()
    const fresh = renderDebug()
    const freshScheme = fresh.getAttribute('data-scheme')
    cleanup()

    // Corrupt value: sanitised at startup, then resolved.
    window.localStorage.clear()
    document.documentElement.removeAttribute(COLOR_SCHEME_ATTR)
    window.localStorage.setItem(THEME_STORAGE_KEY, 'corrupt')
    const corrupt = renderDebug()

    expect(corrupt.getAttribute('data-scheme')).toBe(freshScheme)
    expect(corrupt.getAttribute('data-scheme')).toBe('dark')
  })

  it('should resolve to dark when no value is stored and the OS prefers dark', () => {
    stubMatchMedia(true) // OS = dark, nothing persisted

    const debug = renderDebug()

    expect(debug.getAttribute('data-scheme')).toBe('dark')
  })

  it('should honour an explicit stored light choice even when the OS prefers dark', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light')
    stubMatchMedia(true) // OS = dark

    const debug = renderDebug()

    expect(debug.getAttribute('data-scheme')).toBe('light')
  })

  it('should honour an explicit stored dark choice even when the OS prefers light', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    stubMatchMedia(false) // OS = light

    const debug = renderDebug()

    expect(debug.getAttribute('data-scheme')).toBe('dark')
  })
})
