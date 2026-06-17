import { describe, it, expect } from 'vitest'

/**
 * Behaviour-coverage index (#833).
 *
 * The cross-cutting behaviour flows required by the UI-rework parity baseline
 * were implemented and tested by the earlier stories of epic #825. This file is
 * the single living INDEX of where each flow is verified, so a reviewer (and
 * future maintainers) can confirm "feature parity / no regression" coverage at
 * a glance without re-discovering it. It intentionally does NOT duplicate those
 * tests - it asserts the owning suites still exist, and documents the mapping.
 *
 * Flow -> owning suite:
 *
 * - Theme persistence + OS default + corrupt-value fallback
 *     src/theme/color-scheme-context.test.tsx
 *       ("follow the OS preference on a fresh load",
 *        "prefer a valid persisted value over the OS preference",
 *        "fall back to the OS preference when the stored value is corrupt",
 *        "persist the choice to localStorage when toggled")
 *     src/theme/theme-storage.test.ts            (storage read/write/guard units)
 *     src/shell/app-shell-localstorage-fallback.test.tsx (disabled-storage path)
 *
 * - Routing + unsaved-changes guard on route change AND back/forward
 *     src/shell/use-unsaved-changes-blocker.test.tsx
 *       ("blocks an in-app link navigation",
 *        "blocks programmatic navigation",
 *        "blocks browser back navigation",
 *        "proceeds when the user confirms leaving",
 *        "allows navigation freely once changes are saved")
 *     src/features/albums/album-detail.test.tsx
 *       (describe "AlbumDetail - navigation guard (dirty fields)": back-button
 *        guard, Escape-to-stay, and the act() effect-flush after clearing dirty
 *        so the blocker re-registers before navigating)
 *     src/shell/app-shell.test.tsx               (route nav + back/forward)
 *
 * - Grid pagination (page change, filter resets to page 1, URL round-trip,
 *   back-restore)
 *     src/App.test.tsx
 *       (describe "AlbumListPage - page navigation": page change + URL,
 *        deep-link, clamp, non-numeric guard;
 *        "AlbumListPage - filter resets pagination": filter -> page 1;
 *        "AlbumListPage - navigation preserves state": page survives in URL)
 *     src/features/albums/usePagination.test.tsx (page math + URL round-trip unit)
 *     src/features/albums/useScrollRestoration.test.tsx (scroll back-restore unit)
 *
 * - Dual-mode album list (#853): client-side below the threshold, server-side
 *   above; mode boundary, no 5 000-album truncation, filter/search -> server
 *   params + reset to page 1
 *     src/App.server-mode.test.tsx
 *       (server-side rendering, one-page fetch, deep-link, search mapping,
 *        reading past index 5 000, mode-detection boundary)
 *     src/features/albums/useAlbumList.test.tsx  (orchestrator mode selection)
 *     src/features/albums/useAllAlbums.test.tsx  (probe + threshold switch)
 *     src/features/albums/useAlbumPage.test.tsx  (server page + param mapping)
 *
 * Accessibility (axe) and visual/responsive coverage are indexed in
 * docs/test-strategy.md.
 */

// Eagerly discover every test file under src so the index can assert the owning
// suites still exist, without Node fs APIs (none are typed in this project).
const ALL_TEST_FILES = import.meta.glob('./**/*.test.{ts,tsx}', {
  eager: true,
  query: '?raw',
  import: 'default',
})

const BEHAVIOUR_SUITES = [
  './theme/color-scheme-context.test.tsx',
  './theme/theme-storage.test.ts',
  './shell/app-shell-localstorage-fallback.test.tsx',
  './shell/use-unsaved-changes-blocker.test.tsx',
  './shell/app-shell.test.tsx',
  './features/albums/album-detail.test.tsx',
  './App.test.tsx',
  './features/albums/usePagination.test.tsx',
  './features/albums/useScrollRestoration.test.tsx',
  './App.server-mode.test.tsx',
  './features/albums/useAlbumList.test.tsx',
  './features/albums/useAllAlbums.test.tsx',
  './features/albums/useAlbumPage.test.tsx',
  './features/albums/usePageParams.test.tsx',
] as const

describe('parity behaviour-coverage index', () => {
  it.each(BEHAVIOUR_SUITES)('owns a behaviour suite: %s', (relative) => {
    expect(
      Object.prototype.hasOwnProperty.call(ALL_TEST_FILES, relative),
      `${relative} must exist as a test suite`,
    ).toBe(true)
  })
})
