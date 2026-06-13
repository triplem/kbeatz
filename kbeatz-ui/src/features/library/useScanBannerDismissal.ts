import { useState } from 'react'

const STORAGE_KEY = 'kbeatz.scanBanner.dismissedAt'

/**
 * Read the dismissed completedAt value from localStorage.
 * Returns null when localStorage is unavailable or the key is absent.
 */
function readDismissedAt(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

/**
 * Persist the dismissed completedAt value to localStorage.
 * Silently ignores failures (quota exceeded, blocked by browser policy,
 * or private-mode restriction).
 */
function writeDismissedAt(value: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // Storage unavailable - dismissal lasts for the current session only.
  }
}

interface UseScanBannerDismissalResult {
  /** True when the banner for the given completedAt should be hidden. */
  readonly isDismissed: boolean
  /** Call this when the user dismisses the banner. */
  readonly dismiss: () => void
}

/**
 * Manages scan completion banner dismissal with localStorage persistence.
 *
 * On mount, checks whether the given `completedAt` timestamp was already
 * dismissed in a previous session. If so, the banner starts hidden. When
 * the user dismisses the banner, the value is written to localStorage so
 * subsequent page loads skip the banner for the same scan completion.
 *
 * A new `completedAt` value (a different scan) is never considered dismissed
 * until the user explicitly dismisses it.
 *
 * When localStorage is unavailable, dismissal is session-scoped only - the
 * banner reappears after a page reload but no exception is thrown.
 */
export function useScanBannerDismissal(completedAt: string): UseScanBannerDismissalResult {
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    return readDismissedAt() === completedAt
  })

  const dismiss = (): void => {
    writeDismissedAt(completedAt)
    setIsDismissed(true)
  }

  return { isDismissed, dismiss }
}
