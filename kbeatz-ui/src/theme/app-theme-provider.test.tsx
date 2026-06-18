import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useColorScheme } from '@mui/material/styles'
import { AppThemeProvider } from './app-theme-provider'
import { sanitizePersistedColorScheme } from './theme-storage'
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

  /**
   * Mirror the app startup sequence in main.tsx: corrupt persisted values are
   * removed by `sanitizePersistedColorScheme()` BEFORE the theme provider
   * mounts. Rendering through this helper therefore exercises the real runtime
   * path MUI sees after sanitisation.
   */
  function renderDebug() {
    sanitizePersistedColorScheme()
    render(
      <AppThemeProvider>
        <DebugColorScheme />
      </AppThemeProvider>,
    )
    return screen.getByTestId('debug')
  }

  it('should sanitise a corrupt stored value and fall back to the OS scheme (system mode)', () => {
    // BEHAVIOUR CHANGE (issue #877): MUI's ThemeProvider does NOT sanitise an
    // unknown persisted mode - left alone it would read 'corrupt' verbatim as
    // `mode`, leave `colorScheme` undefined, and write no data-mui-color-scheme,
    // diverging from the no-flash bootstrap. We now remove the invalid key at
    // startup (sanitizePersistedColorScheme), so MUI falls back to its 'system'
    // default and follows the OS preference - identical to the bootstrap.
    window.localStorage.setItem(THEME_STORAGE_KEY, 'corrupt')
    stubMatchMedia(false) // OS = light

    const debug = renderDebug()

    // Invalid value removed: MUI sees no stored mode and uses 'system'.
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
    expect(debug.getAttribute('data-mode')).toBe('system')
    expect(debug.getAttribute('data-scheme')).toBe('light')
  })

  it('should resolve a corrupt value to the OS scheme regardless of OS preference (dark)', () => {
    // After sanitisation the corrupt path follows 'system', so the OS preference
    // now drives the outcome: OS dark resolves to 'dark' (not an unresolved
    // scheme as in the pre-#877 behaviour).
    window.localStorage.setItem(THEME_STORAGE_KEY, 'corrupt')
    stubMatchMedia(true) // OS = dark

    const debug = renderDebug()

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
    expect(debug.getAttribute('data-mode')).toBe('system')
    expect(debug.getAttribute('data-scheme')).toBe('dark')
  })

  it('should resolve a corrupt value the SAME way as a fresh load (bootstrap/MUI equivalence)', () => {
    // AC#2: the corrupt path and the no-stored-value path must agree. Both
    // resolve to 'system' mode following the OS preference. Here OS = dark.
    stubMatchMedia(true) // OS = dark

    // Fresh load: nothing persisted.
    window.localStorage.clear()
    const fresh = renderDebug()
    const freshMode = fresh.getAttribute('data-mode')
    const freshScheme = fresh.getAttribute('data-scheme')
    cleanup()

    // Corrupt value: sanitised at startup, then resolved.
    window.localStorage.clear()
    document.documentElement.removeAttribute(COLOR_SCHEME_ATTR)
    window.localStorage.setItem(THEME_STORAGE_KEY, 'corrupt')
    const corrupt = renderDebug()

    expect(corrupt.getAttribute('data-mode')).toBe(freshMode)
    expect(corrupt.getAttribute('data-scheme')).toBe(freshScheme)
    expect(corrupt.getAttribute('data-mode')).toBe('system')
    expect(corrupt.getAttribute('data-scheme')).toBe('dark')
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
