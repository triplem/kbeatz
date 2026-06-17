import { type ReactNode } from 'react'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { theme } from './theme'
import { ColorSchemeProvider } from './color-scheme-context'

interface AppThemeProviderProps {
  children: ReactNode
}

/**
 * Wraps the app in the single MUI theme plus CssBaseline (global reset and
 * interim isolation) and the color-scheme context that drives the
 * light/dark toggle.
 *
 * The theme uses CSS-variable colour schemes selected by the
 * `data-mui-color-scheme` root attribute. ColorSchemeProvider is the sole
 * authority over that attribute (initial OS-follow, persistence, validation),
 * so MUI's own mode state is intentionally not used here - the attribute swap
 * re-resolves CSS variables without a React re-render.
 */
export function AppThemeProvider({ children }: AppThemeProviderProps) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ColorSchemeProvider>{children}</ColorSchemeProvider>
    </ThemeProvider>
  )
}
