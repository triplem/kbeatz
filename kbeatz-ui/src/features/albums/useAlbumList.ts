import { useMemo } from 'react'
import type { Album } from '../../api/generated'
import {
  applyFiltersAndSort,
  deriveFilterOptions,
  type AlbumFilters,
  type FilterOptions,
  type SortDirection,
  type SortField,
} from './album-filters'
import type { AlbumListMode } from './album-list-mode'
import { computeTotalPages, pageSlice } from './pagination'
import { useAllAlbums } from './useAllAlbums'
import { useAlbumPage } from './useAlbumPage'

const EMPTY_OPTIONS: FilterOptions = { genres: [], artists: [], composers: [] }

interface UseAlbumListArgs {
  /** Current 1-based page from the URL-driven pager. */
  readonly page: number
  /** Active page size. */
  readonly pageSize: number
  readonly filters: AlbumFilters
  readonly sortBy: SortField
  readonly sortDirection: SortDirection
}

export interface UseAlbumListResult {
  /** Which list strategy is active for the current collection size. */
  readonly mode: AlbumListMode
  /** True while the data for the current view is loading. */
  readonly isPending: boolean
  /** True if the underlying query failed. */
  readonly isError: boolean
  /** Refetch the active query (used by the error-state retry button). */
  readonly refetch: () => void
  /** The albums to render for the current page (already sliced). */
  readonly albums: ReadonlyArray<Album>
  /**
   * Total albums matching the active filters. Drives the pager and the
   * "showing X of Y" status. In client mode this is the filtered count; in
   * server mode it is the server-reported `totalElements` for the query.
   */
  readonly totalCount: number
  /**
   * Filter-panel options. Derived from the full set in client mode; empty in
   * server mode (the full set is not loaded, so the panel cannot enumerate
   * every value - server mode relies on free-text/typed filters instead).
   */
  readonly filterOptions: FilterOptions
}

/**
 * Dual-mode album-list data hook (story #853).
 *
 * Selects between client-side and server-side strategies based on the
 * collection size reported by {@link useAllAlbums} (the first-page probe):
 *
 * - **Client-side** (<= threshold): the full set is loaded once; filter, sort,
 *   and pagination run in-memory. Behaviour is identical to the pre-#853 grid.
 * - **Server-side** (> threshold): {@link useAlbumPage} fetches only the
 *   current page with the active filters mapped to server params, and the
 *   server's `totalElements` / `totalPages` drive the pager. No full-set load,
 *   so a 10 000-album library is never truncated (NFR-11 / NFR-12).
 *
 * Both queries are always declared (rules of hooks); the inactive one is gated
 * off via TanStack Query `enabled`, so exactly one issues requests. The mode is
 * taken from the probe result and defaults to client-side until it resolves.
 */
export function useAlbumList({
  page,
  pageSize,
  filters,
  sortBy,
  sortDirection,
}: UseAlbumListArgs): UseAlbumListResult {
  const all = useAllAlbums()
  const mode: AlbumListMode = all.data?.mode ?? 'client'

  // Server-side page query: enabled only above the threshold. The 1-based UI
  // page is clamped against the total reported by the probe (known before the
  // page query, so this does not create a fetch cycle) and converted to the
  // 0-based server index. Clamping here keeps an over-range deep link
  // (e.g. ?page=999) from requesting an empty page while the pager shows the
  // clamped last page - both resolve to the same page.
  const probeTotal = all.data?.totalElements ?? 0
  const serverTotalPages = computeTotalPages(probeTotal, pageSize)
  const serverPageIndex = Math.min(Math.max(1, page), serverTotalPages) - 1
  const serverEnabled = mode === 'server'
  const server = useAlbumPage(
    { page: serverPageIndex, size: pageSize, filters },
    serverEnabled,
  )

  // ----- Client-side mode -------------------------------------------------
  const clientAlbums = useMemo(() => all.data?.albums ?? [], [all.data])

  const filterOptions = useMemo(
    () => (mode === 'client' ? deriveFilterOptions(clientAlbums) : EMPTY_OPTIONS),
    [mode, clientAlbums],
  )

  const filteredAlbums = useMemo(
    () =>
      mode === 'client'
        ? applyFiltersAndSort(clientAlbums, filters, sortBy, sortDirection)
        : [],
    [mode, clientAlbums, filters, sortBy, sortDirection],
  )

  // Clamp the client page against the filtered total before slicing so a
  // deep-linked or stale out-of-range page still renders the last page (matches
  // the displayed pager, which clamps the same way). Server mode does not clamp
  // here: it issues the request for the raw page and the server returns an empty
  // page for an over-range request, after which the pager reconciles the URL.
  const clientVisible = useMemo(() => {
    const clientTotalPages = computeTotalPages(filteredAlbums.length, pageSize)
    const clampedPage = Math.min(Math.max(1, page), clientTotalPages)
    return pageSlice(filteredAlbums, clampedPage, pageSize)
  }, [filteredAlbums, page, pageSize])

  if (mode === 'server') {
    return {
      mode,
      isPending: all.isPending || server.isPending,
      isError: all.isError || server.isError,
      refetch: () => {
        if (all.isError) void all.refetch()
        else void server.refetch()
      },
      albums: server.data?.content ?? [],
      totalCount: server.data?.totalElements ?? all.data?.totalElements ?? 0,
      filterOptions,
    }
  }

  return {
    mode: 'client',
    isPending: all.isPending,
    isError: all.isError,
    refetch: () => {
      void all.refetch()
    },
    albums: clientVisible,
    totalCount: filteredAlbums.length,
    filterOptions,
  }
}
