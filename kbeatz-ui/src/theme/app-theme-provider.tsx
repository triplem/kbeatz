import { type ReactNode } from 'react'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { theme, THEME_STORAGE_KEY } from './theme'

interface AppThemeProviderProps {
  children: ReactNode
}

/**
 * Wraps the app in the single MUI theme plus CssBaseline (global reset and
 * colour isolation).
 *
 * The theme uses CSS-variable colour schemes selected by the
 * `data-mui-color-scheme` root attribute. MUI's ThemeProvider with
 * `cssVariables` manages the attribute and localStorage key directly.
 * `modeStorageKey` is set to our own key (`kbeatz-theme`) so the persisted
 * choice is compatible with the no-flash inline script in index.html, which
 * reads the same key before React hydrates.
 *
 * The `noSsr` prop prevents a flash of unstyled content by skipping the
 * server-side rendering fallback that would otherwise render in the default
 * (light) scheme before hydration.
 */
export function AppThemeProvider({ children }: AppThemeProviderProps) {
  return (
    <ThemeProvider theme={theme} modeStorageKey={THEME_STORAGE_KEY} noSsr>
      <CssBaseline />
      {children}
    </ThemeProvider>
  )
}
