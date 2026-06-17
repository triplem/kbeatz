import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useColorScheme } from '@mui/material/styles'
import { AppThemeProvider } from './app-theme-provider'
import { COLOR_SCHEME_ATTR, THEME_STORAGE_KEY } from './theme'

// Debug component to expose the MUI color scheme context value
function DebugColorScheme() {
  const { colorScheme, mode } = useColorScheme()
  return <div data-testid="debug" data-scheme={colorScheme} data-mode={mode} />
}

/**
 * Stub window.matchMedia to report a given `prefers-color-scheme: dark` result.
 * Mirrors the helper already used in theme-toggle.test.tsx / theme-storage.test.ts
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
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should render children inside the theme + baseline + color-scheme context', () => {
    render(
      <AppThemeProvider>
        <span>app body</span>
      </AppThemeProvider>,
    )
    expect(screen.getByText('app body')).toBeInTheDocument()
  })

  it('should expose light color scheme when no preference is stored and OS is light', () => {
    render(
      <AppThemeProvider>
        <DebugColorScheme />
      </AppThemeProvider>,
    )
    const debug = screen.getByTestId('debug')
    // MUI resolves to 'light' when mode='system' and OS is light (matchMedia.matches=false)
    expect(debug.getAttribute('data-scheme')).toBe('light')
    expect(debug.getAttribute('data-mode')).toBe('system')
  })
})

/**
 * Integration coverage for THIS project's specific MUI ThemeProvider colour-scheme
 * configuration (`modeStorageKey='kbeatz-theme'`, `noSsr`, no explicit `defaultMode`
 * so MUI's `'system'` default applies). MUI tests its own internals; these tests pin
 * the edge-case behaviour our config produces, asserting the resolved scheme through
 * the live `useColorScheme()` context rather than reading storage directly.
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
    render(
      <AppThemeProvider>
        <DebugColorScheme />
      </AppThemeProvider>,
    )
    return screen.getByTestId('debug')
  }

  it('should not crash and should leave the colour scheme unresolved for a corrupt stored value', () => {
    // DIVERGENCE FROM ISSUE #875 ASSUMPTION: MUI's ThemeProvider does NOT sanitise
    // an unknown persisted mode. It reads the raw 'kbeatz-theme' value, passes it
    // through as `mode` verbatim, and because 'corrupt' is not a known mode it
    // cannot resolve a `colorScheme` - so `colorScheme` is `undefined` and no
    // `data-mui-color-scheme` attribute is written to <html>. The visual fallback
    // is the light CSS-variable defaults emitted on :root, but the context exposes
    // no resolved scheme. We assert the real, observed behaviour of our config
    // (no throw, mode passed through, scheme unresolved) rather than the issue's
    // assumed 'light' fallback. The project's own theme-storage.isColorScheme()
    // DOES sanitise this case, but that guard feeds the no-flash inline script /
    // toggle, not MUI's useColorScheme().
    window.localStorage.setItem(THEME_STORAGE_KEY, 'corrupt')
    stubMatchMedia(false) // OS = light

    const debug = renderDebug()

    expect(debug.getAttribute('data-mode')).toBe('corrupt')
    // colorScheme === undefined, so React omits the data-scheme attribute entirely.
    expect(debug.getAttribute('data-scheme')).toBeNull()
    expect(document.documentElement.getAttribute(COLOR_SCHEME_ATTR)).toBeNull()
  })

  it('should behave identically for a corrupt value regardless of OS preference', () => {
    // The corrupt-value path ignores the OS preference entirely (mode is the raw
    // corrupt string, not 'system'), so the unresolved-scheme outcome is the same
    // whether the OS prefers dark or light.
    window.localStorage.setItem(THEME_STORAGE_KEY, 'corrupt')
    stubMatchMedia(true) // OS = dark

    const debug = renderDebug()

    expect(debug.getAttribute('data-mode')).toBe('corrupt')
    expect(debug.getAttribute('data-scheme')).toBeNull()
    expect(document.documentElement.getAttribute(COLOR_SCHEME_ATTR)).toBeNull()
  })

  it('should resolve to dark when no value is stored and the OS prefers dark', () => {
    stubMatchMedia(true) // OS = dark, nothing persisted

    const debug = renderDebug()

    expect(debug.getAttribute('data-mode')).toBe('system')
    expect(debug.getAttribute('data-scheme')).toBe('dark')
  })

  it('should honour an explicit stored light choice even when the OS prefers dark', () => {
    // Explicit choice must win over the OS preference.
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light')
    stubMatchMedia(true) // OS = dark

    const debug = renderDebug()

    expect(debug.getAttribute('data-mode')).toBe('light')
    expect(debug.getAttribute('data-scheme')).toBe('light')
  })

  it('should honour an explicit stored dark choice even when the OS prefers light', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    stubMatchMedia(false) // OS = light

    const debug = renderDebug()

    expect(debug.getAttribute('data-mode')).toBe('dark')
    expect(debug.getAttribute('data-scheme')).toBe('dark')
  })
})
