import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { AlbumsService, type AlbumDetail } from '../../api/generated'

/**
 * Fetch a single album with all its tracks and tag fields.
 *
 * Query key: ['album', id]
 */
export function useAlbum(id: string | undefined): UseQueryResult<AlbumDetail, Error> {
  return useQuery({
    queryKey: ['album', id],
    queryFn: () => AlbumsService.getAlbum({ albumId: id! }),
    enabled: !!id,
  })
}
