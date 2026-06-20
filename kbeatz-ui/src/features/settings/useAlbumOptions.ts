import { useQuery } from '@tanstack/react-query'
import { AlbumsService, type Album } from '../../api/generated'

/** Page size used to populate the album selector (the API caps page size at 100). */
const ALBUM_OPTIONS_PAGE_SIZE = 100

interface UseAlbumOptionsResult {
  readonly albums: ReadonlyArray<Album>
  readonly isPending: boolean
  readonly isError: boolean
}

/**
 * Fetch a single page of albums to populate the layout-preview album selector.
 *
 * This is intentionally a lightweight, first-page-only read: the selector is a
 * convenience for picking one album to preview, not a full browse surface.
 *
 * Query key: ['album-options']
 */
export function useAlbumOptions(): UseAlbumOptionsResult {
  const { data, isPending, isError } = useQuery({
    queryKey: ['album-options'],
    queryFn: () => AlbumsService.listAlbums({ page: 0, size: ALBUM_OPTIONS_PAGE_SIZE }),
  })

  return {
    albums: data?.content ?? [],
    isPending,
    isError,
  }
}
