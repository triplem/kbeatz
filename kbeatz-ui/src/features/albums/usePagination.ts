import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  PAGE_PARAM,
  SIZE_PARAM,
  computeTotalPages,
  loadPageSize,
  parsePageParam,
  parseSizeParam,
  savePageSize,
  type PageSize,
} from './pagination'

interface UsePaginationArgs {
  /** Number of items in the currently filtered/sorted result set. */
  readonly itemCount: number
  /**
   * A stable key describing the active filter/sort. When it changes (i.e. the
   * user changes search/filter/sort), pagination resets to page 1.
   */
  readonly resetKey: string
}

export interface UsePaginationResult {
  /** Current 1-based page, always clamped into [1, totalPages]. */
  readonly page: number
  /** Active page size. */
  readonly pageSize: PageSize
  /** Total number of pages for the current item count + page size (>= 1). */
  readonly totalPages: number
  /** Navigate to a 1-based page. Out-of-range values are clamped. */
  readonly setPage: (page: number) => void
  /** Change the page size. Resets to page 1 and persists to localStorage. */
  readonly setPageSize: (size: PageSize) => void
}

/**
 * Owns all client-side pagination state for the album grid.
 *
 * Responsibilities (keeps the page component a thin renderer per
 * react-patterns.md - no pagination business logic in JSX):
 * - Reflects page + size in URL query params so the view is deep-linkable and
 *   survives reload + back/forward (works with the router from #828).
 * - Persists the page size to localStorage (validated on read in `loadPageSize`).
 * - Resets to page 1 when the active filter/sort changes (`resetKey`).
 * - Clamps the page into the valid range whenever the item count shrinks
 *   (e.g. a filter removes results), so a deep-linked or stale page never
 *   points past the end of the list.
 *
 * The URL is the source of truth for the current page; the page is *derived*
 * from the URL param on every render rather than stored in a second state
 * variable (no derived state in state, per react-patterns.md).
 */
export function usePagination({ itemCount, resetKey }: UsePaginationArgs): UsePaginationResult {
  const [searchParams, setSearchParams] = useSearchParams()

  // Page size: URL param takes precedence (deep-link), else the persisted
  // localStorage default. Derived from the URL each render.
  const pageSize = parseSizeParam(searchParams.get(SIZE_PARAM), loadPageSize())

  const totalPages = computeTotalPages(itemCount, pageSize)

  // Current page derived (and clamped) from the URL param each render.
  const page = parsePageParam(searchParams.get(PAGE_PARAM), totalPages)

  // Reset to page 1 when the active filter/sort changes. During-render state
  // adjustment avoids a setState-in-effect cascade (matches the existing
  // SearchBox pattern in this codebase).
  const [prevResetKey, setPrevResetKey] = useState(resetKey)
  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey)
    if (page !== 1) {
      const next = new URLSearchParams(searchParams)
      next.delete(PAGE_PARAM)
      setSearchParams(next, { replace: true })
    }
  }

  const setPage = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(1, next), totalPages)
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current)
          if (clamped <= 1) {
            params.delete(PAGE_PARAM)
          } else {
            params.set(PAGE_PARAM, String(clamped))
          }
          return params
        },
        { replace: false },
      )
    },
    [setSearchParams, totalPages],
  )

  const setPageSize = useCallback(
    (size: PageSize) => {
      savePageSize(size)
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current)
          params.set(SIZE_PARAM, String(size))
          // Changing page size resets to page 1.
          params.delete(PAGE_PARAM)
          return params
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  return { page, pageSize, totalPages, setPage, setPageSize }
}
