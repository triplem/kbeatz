import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { AlbumsService, type Album } from '../../api/generated'
import { CLIENT_SIDE_THRESHOLD } from './album-list-mode'

/**
 * Maximum page size the API accepts (OpenAPI: "Page size (max 100)").
 * We page through the server result set in chunks of this size to assemble
 * the full in-memory list for client-side pagination (decision D9).
 */
const MAX_API_PAGE_SIZE = 100

/**
 * Discriminated result of the full-load probe.
 *
 * The loader fetches page 0 first to learn `totalElements`. That single fetch
 * decides the mode (NFR-12):
 * - `client`: the collection is small enough (<= {@link CLIENT_SIDE_THRESHOLD})
 *   to load fully and filter/sort/paginate client-side. `albums` holds the
 *   complete set.
 * - `server`: the collection exceeds the threshold. The full set is NOT loaded
 *   (no silent truncation); the caller must switch to server-side pagination
 *   (see `useAlbumPage`). `albums` is empty in this case.
 */
export interface AllAlbumsData {
  /** Which list strategy the collection size selects. */
  readonly mode: 'client' | 'server'
  /** Total albums in the collection, as reported by the first page fetch. */
  readonly totalElements: number
  /**
   * The complete album set for client-side mode; empty in server-side mode
   * (the full set is deliberately not loaded above the threshold).
   */
  readonly albums: ReadonlyArray<Album>
}

/**
 * Fetch the album-summary set for client-side pagination, but only when the
 * collection is small enough to do so.
 *
 * The list endpoint is server-paginated with a max page size of 100. This
 * fetches page 0 first to read `totalElements`:
 * - At or below {@link CLIENT_SIDE_THRESHOLD} it walks the remaining pages and
 *   concatenates them into a single array. No filter params are sent:
 *   search/filter/sort all operate client-side over the full in-memory set
 *   (FR-02/FR-03), so the cached result is filter-agnostic and reused across
 *   every filter change.
 * - Above the threshold it stops after page 0 and reports `mode: 'server'` so
 *   the caller switches to server-side pagination. This replaces the previous
 *   hard `MAX_PAGES = 50` cap that silently truncated the grid at 5 000 albums
 *   (NFR-11 / NFR-12): the collection is never partially loaded and silently
 *   shown as complete.
 *
 * TanStack Query owns caching, background refresh, and loading/error state
 * (no useEffect data fetching, per react-patterns.md).
 */
async function fetchAllAlbums(): Promise<AllAlbumsData> {
  const first = await AlbumsService.listAlbums({ page: 0, size: MAX_API_PAGE_SIZE })

  if (first.totalElements > CLIENT_SIDE_THRESHOLD) {
    return { mode: 'server', totalElements: first.totalElements, albums: [] }
  }

  const all: Album[] = [...first.content]
  for (let pageNum = 1; pageNum < first.totalPages; pageNum += 1) {
    const result = await AlbumsService.listAlbums({ page: pageNum, size: MAX_API_PAGE_SIZE })
    all.push(...result.content)
  }

  return { mode: 'client', totalElements: first.totalElements, albums: all }
}

export type UseAllAlbumsResult = UseQueryResult<AllAlbumsData, Error>

/** React Query wrapper around {@link fetchAllAlbums}. */
export function useAllAlbums(): UseAllAlbumsResult {
  return useQuery({
    queryKey: ['albums', 'all'],
    queryFn: fetchAllAlbums,
    staleTime: 30_000,
  })
}
