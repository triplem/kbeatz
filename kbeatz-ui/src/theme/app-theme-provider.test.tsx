import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useColorScheme } from '@mui/material/styles'
import { AppThemeProvider } from './app-theme-provider'
import { COLOR_SCHEME_ATTR } from './theme'

// Debug component to expose the MUI color scheme context value
function DebugColorScheme() {
  const { colorScheme, mode } = useColorScheme()
  return <div data-testid="debug" data-scheme={colorScheme} data-mode={mode} />
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
