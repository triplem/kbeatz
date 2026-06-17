import { useQuery } from '@tanstack/react-query'
import { AlbumsService, type Album } from '../../api/generated'

/**
 * Maximum page size the API accepts (OpenAPI: "Page size (max 100)").
 * We page through the server result set in chunks of this size to assemble
 * the full in-memory list for client-side pagination (decision D9).
 */
const MAX_API_PAGE_SIZE = 100

/**
 * Hard ceiling on the number of pages fetched, as a safety valve against an
 * unbounded loop if totalPages is ever mis-reported by the server.
 * 50 pages * 100 = 5 000 albums, matching the client-side filtering threshold
 * documented on the listAlbums endpoint (NFR-12).
 */
const MAX_PAGES = 50

/**
 * Fetch the full album-summary list once for client-side pagination.
 *
 * The list endpoint is server-paginated with a max page size of 100, so this
 * walks the pages sequentially and concatenates them into a single array.
 * No filter params are sent: search/filter/sort all operate client-side over
 * the full in-memory set (FR-02/FR-03), so the cached result is filter-agnostic
 * and reused across every filter change.
 *
 * TanStack Query owns caching, background refresh, and loading/error state
 * (no useEffect data fetching, per react-patterns.md).
 */
async function fetchAllAlbums(): Promise<Album[]> {
  const all: Album[] = []

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = await AlbumsService.listAlbums({ page, size: MAX_API_PAGE_SIZE })
    all.push(...result.content)
    if (page + 1 >= result.totalPages) break
  }

  return all
}

/** React Query wrapper around {@link fetchAllAlbums}. */
export function useAllAlbums() {
  return useQuery({
    queryKey: ['albums', 'all'],
    queryFn: fetchAllAlbums,
    staleTime: 30_000,
  })
}
