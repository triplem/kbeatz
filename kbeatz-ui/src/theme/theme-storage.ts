import { type ColorScheme, THEME_STORAGE_KEY } from './theme'

/** A stored value is valid only if it is exactly 'light' or 'dark'. */
export function isColorScheme(value: unknown): value is ColorScheme {
  return value === 'light' || value === 'dark'
}

/**
 * Resolve the OS preference. Falls back to 'light' when matchMedia is
 * unavailable (e.g. non-browser environments).
 */
export function getOsColorScheme(): ColorScheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light'
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * Read the persisted user choice. Returns null when no valid stored value
 * exists (absent, corrupt, or unknown). localStorage access is guarded so a
 * disabled/unavailable store degrades gracefully rather than throwing.
 */
export function readStoredColorScheme(): ColorScheme | null {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isColorScheme(raw) ? raw : null
  } catch {
    return null
  }
}

/**
 * The effective initial scheme: a valid persisted choice if present, otherwise
 * the OS preference.
 */
export function resolveInitialColorScheme(): ColorScheme {
  return readStoredColorScheme() ?? getOsColorScheme()
}

/**
 * Remove a corrupt/unknown persisted `kbeatz-theme` value so the React runtime
 * (MUI `useColorScheme`) never reads an invalid mode. Unlike the no-flash
 * bootstrap and `isColorScheme()` guard, MUI does NOT sanitise the stored mode:
 * it would otherwise read a corrupt value verbatim and diverge from the
 * pre-paint bootstrap (theme mismatch/flash). Call this once at startup before
 * rendering the theme provider so MUI falls back to `system` (OS preference),
 * matching the bootstrap.
 *
 * A valid value is left untouched. localStorage access is guarded so a
 * disabled/unavailable store degrades gracefully rather than throwing.
 */
export function sanitizePersistedColorScheme(): void {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (raw !== null && !isColorScheme(raw)) {
      window.localStorage.removeItem(THEME_STORAGE_KEY)
    }
  } catch {
    // localStorage unavailable (private mode, disabled) - non-fatal.
  }
}

/**
 * Persist the user's explicit choice. Silently no-ops when localStorage is
 * unavailable so the in-memory toggle still works.
 */
export function storeColorScheme(scheme: ColorScheme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, scheme)
  } catch {
    // localStorage unavailable (private mode, disabled) - non-fatal.
  }
}
