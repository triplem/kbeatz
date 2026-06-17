import { createTheme } from '@mui/material/styles'
import { ON_COLOR, ROLE, SURFACE } from './palette'

/**
 * Storage key + attribute the no-flash inline script and the React provider
 * share. Keep in sync with the inline script in index.html.
 */
export const THEME_STORAGE_KEY = 'kbeatz-theme'
export const COLOR_SCHEME_ATTR = 'data-mui-color-scheme'

/** Allowed persisted values. Anything else is treated as corrupt. */
export type ColorScheme = 'light' | 'dark'

/**
 * Extra brand tokens exposed on the theme so feature code reads accessible
 * "on-color" foreground values from the single source of truth rather than
 * hard-coding hex literals.
 */
declare module '@mui/material/styles' {
  // Opt in to the typed CSS-variables theme (theme.vars / theme.colorSchemes /
  // theme.cssVarPrefix / theme.colorSchemeSelector) since cssVariables is enabled.
  interface CssThemeVariables {
    enabled: true
  }
  interface Palette {
    brandOn: {
      violet: string
      pink: string
      teal: string
      amber: string
    }
  }
  interface PaletteOptions {
    brandOn?: {
      violet: string
      pink: string
      teal: string
      amber: string
    }
  }
}

/**
 * Single source of truth for the MUI theme.
 *
 * Uses MUI's CSS-variable colour schemes: both light and dark are emitted as
 * CSS custom properties under a single stylesheet, and switching is a
 * `data-mui-color-scheme` attribute swap on <html> (no React re-render).
 */
export const theme = createTheme({
  cssVariables: {
    colorSchemeSelector: 'data',
  },
  colorSchemes: {
    light: {
      palette: {
        mode: 'light',
        primary: ROLE.light.primary,
        secondary: ROLE.light.secondary,
        error: ROLE.light.error,
        success: ROLE.light.success,
        warning: ROLE.light.warning,
        background: {
          default: SURFACE.light.background,
          paper: SURFACE.light.paper,
        },
        text: {
          primary: SURFACE.light.textPrimary,
          secondary: SURFACE.light.textSecondary,
        },
        divider: SURFACE.light.divider,
        brandOn: ON_COLOR.light,
      },
    },
    dark: {
      palette: {
        mode: 'dark',
        primary: ROLE.dark.primary,
        secondary: ROLE.dark.secondary,
        error: ROLE.dark.error,
        success: ROLE.dark.success,
        warning: ROLE.dark.warning,
        background: {
          default: SURFACE.dark.background,
          paper: SURFACE.dark.paper,
        },
        text: {
          primary: SURFACE.dark.textPrimary,
          secondary: SURFACE.dark.textSecondary,
        },
        divider: SURFACE.dark.divider,
        brandOn: ON_COLOR.dark,
      },
    },
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily: [
      'system-ui',
      '-apple-system',
      'BlinkMacSystemFont',
      'Segoe UI',
      'Roboto',
      'sans-serif',
    ].join(','),
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: (themeParam) => ({
        // Visible keyboard-focus ring for any focusable element that does not
        // ship its own MUI focus indicator (WCAG 2.4.7). Reads the primary
        // colour from the CSS-variable theme so the ring follows the active
        // colour scheme. Replaces the former global rule in legacy tokens.css.
        ':focus-visible': {
          outline: `2px solid ${themeParam.vars.palette.primary.main}`,
          outlineOffset: '2px',
        },
        // Respect the user's reduced-motion preference (WCAG 2.3.3).
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': {
            animationDuration: '0.01ms !important',
            animationIterationCount: '1 !important',
            transitionDuration: '0.01ms !important',
            scrollBehavior: 'auto !important',
          },
        },
      }),
    },
  },
})
