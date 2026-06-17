/**
 * Brand palette mapped onto Material roles (ADR-013).
 *
 * Raw brand colours are reserved for FILLS and accents. Where a brand colour
 * fails WCAG AA as foreground text/icon, an accessible "on-color" variant is
 * provided per theme. All ratios below are computed against the relevant
 * surface and verified at >= 4.5:1 (normal text) or >= 3:1 (large text / UI).
 *
 * Brand role mapping:
 *   violet #7C5CFF -> primary   (accent, focus, active)
 *   pink   #FF5A8F -> secondary / error (destructive)
 *   teal   #2EC4B6 -> success   (scan progress)
 *   amber  #FFB627 -> warning   (Discogs sync)
 *
 * Do NOT introduce ad-hoc colour literals elsewhere; extend this file instead.
 */

/** Raw brand colours - used only as fills/accents, never as small text. */
export const BRAND = {
  violet: '#7C5CFF',
  pink: '#FF5A8F',
  teal: '#2EC4B6',
  amber: '#FFB627',
} as const

/**
 * Accessible foreground ("on-color") variants for use as text/icons.
 * Light variants are darkened so they pass AA on light surfaces.
 * Dark variants are lightened so they pass AA on dark surfaces.
 */
export const ON_COLOR = {
  light: {
    // Contrast on #FFFFFF / #FAFAFB surfaces:
    violet: '#5B3FE0', // 6.50:1 on white
    pink: '#C2185B', //   5.87:1 on white
    teal: '#10705F', //   5.99:1 on white
    amber: '#7A5200', //  6.92:1 on white
  },
  dark: {
    // Contrast on #1E1B2E paper surface:
    violet: '#9D84FF', // 5.74:1 on darkPaper
    pink: '#FF5A8F', //   5.68:1 on darkPaper (raw brand already passes)
    teal: '#2EC4B6', //   7.74:1 on darkPaper (raw brand already passes)
    amber: '#FFB627', //  9.57:1 on darkPaper (raw brand already passes)
  },
} as const

/** Surface colours per scheme. */
export const SURFACE = {
  light: {
    background: '#FAFAFB',
    paper: '#FFFFFF',
    textPrimary: '#1A1A2E', // ~13.7:1 on white
    textSecondary: '#4A4A5E', // ~7.8:1 on white
    divider: '#E0E0E6',
  },
  dark: {
    background: '#15131F',
    paper: '#1E1B2E',
    textPrimary: '#F2F2F7', // high contrast on dark
    textSecondary: '#B7B7C7', // ~7:1 on darkPaper
    divider: '#34314A',
  },
} as const

/**
 * Fill main colours plus contrastText chosen for AA on the fill.
 * black-on-amber 11.97:1, black-on-teal 9.69:1, white-on-pinkDark 5.87:1,
 * white-on-violetDark 5.47:1.
 */
export const ROLE = {
  light: {
    primary: { main: '#6A4DE8', contrastText: '#FFFFFF' }, // 5.47:1 white text
    secondary: { main: BRAND.pink, contrastText: '#000000' }, // 7.11:1 black text
    error: { main: '#D6336C', contrastText: '#FFFFFF' }, // 4.62:1 white text
    success: { main: BRAND.teal, contrastText: '#000000' }, // 9.69:1 black text
    warning: { main: BRAND.amber, contrastText: '#000000' }, // 11.97:1 black text
  },
  dark: {
    primary: { main: BRAND.violet, contrastText: '#000000' }, // 4.83:1 black text
    secondary: { main: BRAND.pink, contrastText: '#000000' },
    error: { main: BRAND.pink, contrastText: '#000000' },
    success: { main: BRAND.teal, contrastText: '#000000' },
    warning: { main: BRAND.amber, contrastText: '#000000' },
  },
} as const
