import { useEffect, useRef } from 'react'

/**
 * Restore window scroll position for a keyed view across navigations.
 *
 * Returning to the album grid from album detail should land the user exactly
 * where they were (AC6: "restores the previous page, scroll position, and
 * active filters - no reset-to-top"). The active page and filters already
 * survive via URL query params; this hook handles the vertical scroll offset.
 *
 * Strategy:
 * - Persist `window.scrollY` to sessionStorage continuously (debounced via a
 *   scroll listener) under a per-view key.
 * - On mount (and whenever `ready` flips true, i.e. once album data is rendered
 *   so the page is tall enough to scroll), restore the saved offset.
 *
 * sessionStorage is used so the value is cleared when the tab closes and never
 * leaks across sessions. All access is wrapped in try/catch so a disabled or
 * full storage degrades gracefully to "no restoration" (Operations AC).
 *
 * @param key   Stable key identifying the view (e.g. the route pathname).
 * @param ready Whether the content that determines scroll height is rendered.
 *              Restoration is deferred until this is true so the target offset
 *              is actually reachable.
 */
export function useScrollRestoration(key: string, ready: boolean): void {
  const storageKey = `kbeatz.scroll.${key}`
  const restoredRef = useRef(false)

  // Restore once content is ready.
  useEffect(() => {
    if (!ready || restoredRef.current) return
    restoredRef.current = true
    try {
      const raw = sessionStorage.getItem(storageKey)
      if (raw === null) return
      const y = Number.parseInt(raw, 10)
      if (Number.isFinite(y) && y > 0) {
        // Defer to the next frame so layout has settled and the offset exists.
        requestAnimationFrame(() => {
          window.scrollTo(0, y)
        })
      }
    } catch {
      // sessionStorage unavailable - skip restoration
    }
  }, [ready, storageKey])

  // Persist scroll position as the user scrolls and on unmount.
  useEffect(() => {
    const persist = (): void => {
      try {
        sessionStorage.setItem(storageKey, String(window.scrollY))
      } catch {
        // sessionStorage unavailable - skip persistence
      }
    }
    window.addEventListener('scroll', persist, { passive: true })
    return () => {
      window.removeEventListener('scroll', persist)
      persist()
    }
  }, [storageKey])
}
