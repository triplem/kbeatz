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
