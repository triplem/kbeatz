import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Theme } from '@astryxdesign/core'
import { LinkProvider } from '@astryxdesign/core/Link'
import { appTheme, COLOR_SCHEME_ATTR, type ColorScheme } from './theme'
import { resolveInitialColorScheme, storeColorScheme } from './theme-storage'
import { AstryxRouterLink } from '../lib/astryx-router-link'

interface AppThemeProviderProps {
  children: ReactNode
}

interface ColorSchemeContextValue {
  /** The active resolved scheme (always an explicit 'light' or 'dark'). */
  readonly colorScheme: ColorScheme
  /** Set an explicit scheme, persist it, and apply it to the DOM. */
  readonly setColorScheme: (scheme: ColorScheme) => void
  /** Flip between light and dark. */
  readonly toggle: () => void
}

const ColorSchemeContext = createContext<ColorSchemeContextValue | null>(null)

/**
 * Mirror the active scheme onto <html>: the data attribute selects the kbeatz
 * brand-token scheme in kbeatz-tokens.css and the `color-scheme` property makes
 * native controls (scrollbars, form widgets) follow the toggle. This keeps the
 * pre-paint bootstrap value and the React state in agreement.
 */
function applyColorSchemeToDom(scheme: ColorScheme): void {
  const root = document.documentElement
  root.setAttribute(COLOR_SCHEME_ATTR, scheme)
  root.style.colorScheme = scheme
}

/**
 * Wraps the app in the single Astryx theme (neutral). Owns the light/dark
 * color scheme: initialised from the persisted choice (or the OS preference),
 * exposed through `useColorScheme`, and pushed to both the Astryx `<Theme mode>`
 * prop and the <html> attribute so components and brand tokens switch together.
 */
export function AppThemeProvider({ children }: AppThemeProviderProps) {
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(() =>
    resolveInitialColorScheme(),
  )

  const setColorScheme = useCallback((scheme: ColorScheme) => {
    setColorSchemeState(scheme)
    storeColorScheme(scheme)
    applyColorSchemeToDom(scheme)
  }, [])

  const toggle = useCallback(() => {
    setColorSchemeState((current) => {
      const next: ColorScheme = current === 'dark' ? 'light' : 'dark'
      storeColorScheme(next)
      applyColorSchemeToDom(next)
      return next
    })
  }, [])

  // Reconcile the DOM with React state on mount so a seeded/bootstrapped value
  // and the resolved initial scheme never diverge.
  useEffect(() => {
    applyColorSchemeToDom(colorScheme)
  }, [colorScheme])

  const value = useMemo<ColorSchemeContextValue>(
    () => ({ colorScheme, setColorScheme, toggle }),
    [colorScheme, setColorScheme, toggle],
  )

  return (
    <ColorSchemeContext.Provider value={value}>
      <Theme theme={appTheme} mode={colorScheme}>
        <LinkProvider component={AstryxRouterLink}>{children}</LinkProvider>
      </Theme>
    </ColorSchemeContext.Provider>
  )
}

/** Access the active color scheme and setters. Throws outside the provider. */
export function useColorScheme(): ColorSchemeContextValue {
  const ctx = useContext(ColorSchemeContext)
  if (!ctx) {
    throw new Error('useColorScheme must be used inside AppThemeProvider')
  }
  return ctx
}
