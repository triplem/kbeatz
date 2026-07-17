import { neutralTheme } from '@astryxdesign/theme-neutral'

/**
 * Storage key + attribute the no-flash inline script (index.html) and the React
 * provider (AppThemeProvider) share. Keep in sync with the inline script.
 *
 * The attribute is set on <html>; it selects the kbeatz brand-token scheme in
 * kbeatz-tokens.css and drives the CSS `color-scheme` property. The Astryx
 * `<Theme mode>` prop is driven from the same source so components and brand
 * tokens switch light/dark together.
 */
export const THEME_STORAGE_KEY = 'kbeatz-theme'
export const COLOR_SCHEME_ATTR = 'data-kbeatz-color-scheme'

/** Allowed persisted values. Anything else is treated as corrupt. */
export type ColorScheme = 'light' | 'dark'

/**
 * The single active Astryx theme. Runtime injection is used (not the /built
 * subpath): this is a client-only SPA, so there is no SSR hydration flash to
 * avoid, and the runtime import keeps the setup free of a build plugin.
 */
export const appTheme = neutralTheme
