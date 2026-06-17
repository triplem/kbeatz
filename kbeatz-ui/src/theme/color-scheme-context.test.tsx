import { render, renderHook, screen, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type ReactNode } from 'react'
import { ColorSchemeProvider, useColorScheme } from './color-scheme-context'
import { COLOR_SCHEME_ATTR, THEME_STORAGE_KEY } from './theme'

let mediaListeners: Array<() => void> = []

function stubMatchMedia(prefersDark: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: prefersDark,
      media: '',
      onchange: null,
      addEventListener: (_: string, cb: () => void) => mediaListeners.push(cb),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  )
}

function wrapper({ children }: { children: ReactNode }) {
  return <ColorSchemeProvider>{children}</ColorSchemeProvider>
}

describe('ColorSchemeProvider / useColorScheme', () => {
  beforeEach(() => {
    mediaListeners = []
    window.localStorage.clear()
    document.documentElement.removeAttribute(COLOR_SCHEME_ATTR)
    stubMatchMedia(false)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should follow the OS preference on a fresh load with no stored value', () => {
    stubMatchMedia(true) // OS = dark
    const { result } = renderHook(() => useColorScheme(), { wrapper })
    expect(result.current.colorScheme).toBe('dark')
  })

  it('should prefer a valid persisted value over the OS preference', () => {
    stubMatchMedia(true) // OS = dark
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light')
    const { result } = renderHook(() => useColorScheme(), { wrapper })
    expect(result.current.colorScheme).toBe('light')
  })

  it('should fall back to the OS preference when the stored value is corrupt', () => {
    stubMatchMedia(true) // OS = dark
    window.localStorage.setItem(THEME_STORAGE_KEY, 'corrupt-value')
    const { result } = renderHook(() => useColorScheme(), { wrapper })
    expect(result.current.colorScheme).toBe('dark')
  })

  it('should persist the choice to localStorage when toggled', () => {
    stubMatchMedia(false) // OS = light
    const { result } = renderHook(() => useColorScheme(), { wrapper })
    expect(result.current.colorScheme).toBe('light')

    act(() => {
      result.current.toggleColorScheme()
    })

    expect(result.current.colorScheme).toBe('dark')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('should apply the scheme to the document root attribute (CSS-var swap, no re-render)', () => {
    stubMatchMedia(false)
    const { result } = renderHook(() => useColorScheme(), { wrapper })
    expect(document.documentElement.getAttribute(COLOR_SCHEME_ATTR)).toBe('light')

    act(() => {
      result.current.setColorScheme('dark')
    })

    expect(document.documentElement.getAttribute(COLOR_SCHEME_ATTR)).toBe('dark')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('should follow OS change events only while no explicit choice is stored', () => {
    stubMatchMedia(false) // OS = light initially
    const { result } = renderHook(() => useColorScheme(), { wrapper })
    expect(result.current.colorScheme).toBe('light')

    // Simulate the OS switching to dark with no stored choice.
    stubMatchMedia(true)
    act(() => {
      mediaListeners.forEach((cb) => {
        cb()
      })
    })
    expect(result.current.colorScheme).toBe('dark')
  })

  it('should ignore OS change events once the user has chosen explicitly', () => {
    stubMatchMedia(false)
    const { result } = renderHook(() => useColorScheme(), { wrapper })

    act(() => {
      result.current.setColorScheme('light') // explicit choice persisted
    })

    // OS flips to dark; explicit choice must win.
    stubMatchMedia(true)
    act(() => {
      mediaListeners.forEach((cb) => {
        cb()
      })
    })
    expect(result.current.colorScheme).toBe('light')
  })

  it('should throw when used outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useColorScheme())).toThrow(
      /must be used inside ColorSchemeProvider/,
    )
    spy.mockRestore()
  })

  it('should still toggle in memory when localStorage is unavailable', () => {
    stubMatchMedia(false)
    const getSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    const { result } = renderHook(() => useColorScheme(), { wrapper })
    expect(result.current.colorScheme).toBe('light')
    act(() => {
      result.current.toggleColorScheme()
    })
    expect(result.current.colorScheme).toBe('dark')

    getSpy.mockRestore()
    setSpy.mockRestore()
  })

  it('should render children', () => {
    render(
      <ColorSchemeProvider>
        <span>child content</span>
      </ColorSchemeProvider>,
    )
    expect(screen.getByText('child content')).toBeInTheDocument()
  })
})
