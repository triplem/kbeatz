import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppThemeProvider } from './app-theme-provider'
import { COLOR_SCHEME_ATTR } from './theme'

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

  it('should set the root colour-scheme attribute on mount', () => {
    render(
      <AppThemeProvider>
        <span>app body</span>
      </AppThemeProvider>,
    )
    expect(document.documentElement.getAttribute(COLOR_SCHEME_ATTR)).toBe('light')
  })
})
