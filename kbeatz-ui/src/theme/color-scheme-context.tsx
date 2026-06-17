import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { COLOR_SCHEME_ATTR, type ColorScheme } from './theme'
import {
  getOsColorScheme,
  readStoredColorScheme,
  resolveInitialColorScheme,
  storeColorScheme,
} from './theme-storage'

interface ColorSchemeContextValue {
  /** The active scheme. */
  colorScheme: ColorScheme
  /** Set the scheme explicitly and persist the choice. */
  setColorScheme: (scheme: ColorScheme) => void
  /** Flip between light and dark and persist the choice. */
  toggleColorScheme: () => void
}

const ColorSchemeContext = createContext<ColorSchemeContextValue | null>(null)

/** Apply the scheme to the document root so CSS variables re-resolve. */
function applyColorScheme(scheme: ColorScheme): void {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute(COLOR_SCHEME_ATTR, scheme)
  }
}

interface ColorSchemeProviderProps {
  children: ReactNode
}

export function ColorSchemeProvider({ children }: ColorSchemeProviderProps) {
  // Initial value follows a valid persisted choice, otherwise the OS setting.
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(() =>
    resolveInitialColorScheme(),
  )

  // Keep the root attribute in sync. The no-flash inline script sets it before
  // hydration; this re-affirms it and updates it on every change. The change is
  // an attribute swap (CSS variables re-resolve), not a React re-render cascade.
  useEffect(() => {
    applyColorScheme(colorScheme)
  }, [colorScheme])

  // Follow OS changes only while the user has made no explicit choice yet.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (): void => {
      if (readStoredColorScheme() === null) {
        setColorSchemeState(getOsColorScheme())
      }
    }
    media.addEventListener('change', onChange)
    return () => {
      media.removeEventListener('change', onChange)
    }
  }, [])

  const setColorScheme = useCallback((scheme: ColorScheme) => {
    storeColorScheme(scheme)
    setColorSchemeState(scheme)
  }, [])

  const toggleColorScheme = useCallback(() => {
    setColorSchemeState((current) => {
      const next: ColorScheme = current === 'dark' ? 'light' : 'dark'
      storeColorScheme(next)
      return next
    })
  }, [])

  const value = useMemo<ColorSchemeContextValue>(
    () => ({ colorScheme, setColorScheme, toggleColorScheme }),
    [colorScheme, setColorScheme, toggleColorScheme],
  )

  return <ColorSchemeContext.Provider value={value}>{children}</ColorSchemeContext.Provider>
}

export function useColorScheme(): ColorSchemeContextValue {
  const ctx = useContext(ColorSchemeContext)
  if (!ctx) {
    throw new Error('useColorScheme must be used inside ColorSchemeProvider')
  }
  return ctx
}
