import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query'
import { AlbumsService, type AlbumPage } from '../../api/generated'
import type { AlbumFilters } from './album-filters'

/**
 * Map the client filter model to the `listAlbums` server query params.
 *
 * The client filter model allows multiple selected values per axis
 * (multi-select chips), but the server endpoint accepts a single value per
 * axis (`albumArtist` / `composer` contains, `genre` exact). In server-side
 * mode we therefore send the FIRST selected value of each axis. This is a
 * documented limitation of server mode (see `useAlbumPage`'s doc comment and
 * docs/test-strategy.md): above the threshold, multi-value selection collapses
 * to its first value. Free-text search maps directly to `q` (free-text across
 * title / albumArtist / composer / label).
 */
export interface AlbumPageQuery {
  /** Zero-based server page index. */
  readonly page: number
  /** Server page size (max 100). */
  readonly size: number
  readonly filters: AlbumFilters
}

interface ServerParams {
  page: number
  size: number
  albumArtist?: string
  composer?: string
  genre?: string
  q?: string
}

/** Build the `listAlbums` params from a page request, omitting empty filters. */
export function toServerParams({ page, size, filters }: AlbumPageQuery): ServerParams {
  const params: ServerParams = { page, size }
  const artist = filters.artists[0]
  const composer = filters.composers[0]
  const genre = filters.genres[0]
  const query = filters.query.trim()
  if (artist !== undefined && artist !== '') params.albumArtist = artist
  if (composer !== undefined && composer !== '') params.composer = composer
  if (genre !== undefined && genre !== '') params.genre = genre
  if (query !== '') params.q = query
  return params
}

/**
 * Fetch a single server page of albums with the active filters applied
 * server-side (server-side mode, NFR-12).
 *
 * Used only above {@link import('./album-list-mode').CLIENT_SIDE_THRESHOLD}.
 * Only the requested page is fetched and rendered: there is no full-set load
 * and therefore no truncation at any collection size. Changing the page,
 * size, or any filter produces a new query key, so TanStack Query caches each
 * page+filter combination independently (correct caching per mode).
 *
 * `keepPreviousData` keeps the previous page on screen while the next page
 * loads, avoiding a spinner flash on every page step.
 *
 * Sort limitation: the `listAlbums` endpoint exposes no sort parameter, so in
 * server-side mode the order is the server's default (stable album ordering)
 * and any client-side sort can only reorder the CURRENT page. The page
 * component does not apply a client sort in server mode; this limitation is
 * documented in docs/test-strategy.md.
 *
 * @param query   The page request (page/size/filters).
 * @param enabled Whether the query should run (false in client-side mode so no
 *                request is issued).
 */
export function useAlbumPage(
  query: AlbumPageQuery,
  enabled: boolean,
): UseQueryResult<AlbumPage, Error> {
  const params = toServerParams(query)
  return useQuery({
    queryKey: ['albums', 'page', params],
    queryFn: () => AlbumsService.listAlbums(params),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}
