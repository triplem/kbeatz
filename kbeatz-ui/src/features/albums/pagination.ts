/**
 * Client-side pagination constants and helpers for the album grid.
 *
 * Pagination is display-only (decision D9 / UI-FR-13): the full album summary
 * set is loaded once, then a single page of cards is rendered at a time.
 *
 * Page size is user-selectable and persisted in localStorage. The page number
 * is reflected in a URL query param so the view is deep-linkable and survives
 * reload + back/forward.
 */

/** Selectable page sizes offered to the user. */
export const PAGE_SIZE_OPTIONS = [25, 50, 100, 250] as const

export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number]

/** Sensible default page size (UI-FR-13: "~50"). */
export const DEFAULT_PAGE_SIZE: PageSize = 50

/** localStorage key for the persisted page size. */
export const PAGE_SIZE_STORAGE_KEY = 'kbeatz.pageSize'

/** URL query param names for deep-linkable pagination state. */
export const PAGE_PARAM = 'page'
export const SIZE_PARAM = 'size'

/** Type guard: is the given number an allowed page size? */
export function isPageSize(value: number): value is PageSize {
  return (PAGE_SIZE_OPTIONS as ReadonlyArray<number>).includes(value)
}

/**
 * Load the persisted page size from localStorage.
 *
 * Validates on read: any value that is not one of PAGE_SIZE_OPTIONS
 * (corrupt, tampered, or from an older build) falls back to the default.
 * Gracefully returns the default when localStorage is unavailable.
 */
export function loadPageSize(): PageSize {
  try {
    const raw = localStorage.getItem(PAGE_SIZE_STORAGE_KEY)
    if (raw === null) return DEFAULT_PAGE_SIZE
    const parsed = Number.parseInt(raw, 10)
    if (Number.isFinite(parsed) && isPageSize(parsed)) return parsed
  } catch {
    // localStorage unavailable (private mode, disabled) - use default
  }
  return DEFAULT_PAGE_SIZE
}

/** Persist the page size to localStorage. Silently ignores write failures. */
export function savePageSize(size: PageSize): void {
  try {
    localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(size))
  } catch {
    // Silently ignore write failures (quota, private mode)
  }
}

/**
 * Parse a 1-based page number from a raw query-param string.
 *
 * Validates on read: non-numeric, zero, negative, or out-of-range values are
 * clamped into [1, totalPages]. Returns a 1-based page number.
 */
export function parsePageParam(raw: string | null, totalPages: number): number {
  const max = Math.max(1, totalPages)
  if (raw === null) return 1
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 1) return 1
  if (parsed > max) return max
  return parsed
}

/** Parse a page size from a raw query-param string, falling back to a default. */
export function parseSizeParam(raw: string | null, fallback: PageSize): PageSize {
  if (raw === null) return fallback
  const parsed = Number.parseInt(raw, 10)
  if (Number.isFinite(parsed) && isPageSize(parsed)) return parsed
  return fallback
}

/** Total number of pages for a given item count and page size (minimum 1). */
export function computeTotalPages(itemCount: number, pageSize: number): number {
  if (itemCount <= 0) return 1
  return Math.ceil(itemCount / pageSize)
}

/**
 * Return the slice of items for a 1-based page.
 *
 * Pure function over the full filtered list - only this slice is rendered,
 * keeping the DOM small regardless of collection size (Performance AC).
 */
export function pageSlice<T>(items: ReadonlyArray<T>, page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize
  return items.slice(start, start + pageSize)
}
