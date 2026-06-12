import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AlbumsService } from '../../api/generated'
import { type AlbumFilters } from './album-filters'

const DEFAULT_PAGE_SIZE = 20

/**
 * Fetches a single paginated album page from the server, applying all active filters.
 *
 * Uses TanStack Query for caching and background refresh. keepPreviousData ensures
 * the previous page stays visible while the next page loads (no flicker on pagination).
 *
 * Only single-value artist/genre/composer selections are sent as server-side params.
 * Multi-value selections fall back to client-side filtering on the current page until
 * a follow-up story adds a multi-value server-side filter endpoint.
 */
export function useAlbumPage(page: number, filters: AlbumFilters) {
  return useQuery({
    queryKey: [
      'albums',
      {
        page,
        q: filters.query || undefined,
        albumArtist: filters.artists.length === 1 ? filters.artists[0] : undefined,
        composer: filters.composers.length === 1 ? filters.composers[0] : undefined,
        genre: filters.genres.length === 1 ? filters.genres[0] : undefined,
        yearFrom: filters.yearMin ?? undefined,
        yearTo: filters.yearMax ?? undefined,
      },
    ],
    queryFn: () =>
      AlbumsService.listAlbums({
        page,
        size: DEFAULT_PAGE_SIZE,
        q: filters.query.trim() || undefined,
        albumArtist: filters.artists.length === 1 ? filters.artists[0] : undefined,
        composer: filters.composers.length === 1 ? filters.composers[0] : undefined,
        genre: filters.genres.length === 1 ? filters.genres[0] : undefined,
        yearFrom: filters.yearMin ?? undefined,
        yearTo: filters.yearMax ?? undefined,
      }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}
