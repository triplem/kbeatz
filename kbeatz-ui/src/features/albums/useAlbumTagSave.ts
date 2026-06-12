import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlbumsService, type AlbumDetail } from '../../api/generated'

interface SaveTagVariables {
  readonly field: string
  readonly value: string
}

interface UseAlbumTagSaveResult {
  readonly save: (vars: SaveTagVariables) => Promise<AlbumDetail>
  readonly isPending: boolean
  readonly error: Error | null
}

/**
 * Mutation for writing an album-level FLAC tag field.
 *
 * On success invalidates both ['album', id] and ['albums'] so the
 * album list and detail views reflect the updated tag immediately.
 */
export function useAlbumTagSave(id: string | undefined): UseAlbumTagSaveResult {
  const queryClient = useQueryClient()

  const mutation = useMutation<AlbumDetail, Error, SaveTagVariables>({
    mutationFn: ({ field, value }) => {
      if (!id) return Promise.reject(new Error('Album id is required'))
      return AlbumsService.updateAlbumTags({
        albumId: id,
        requestBody: { field, value },
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['album', id] })
      void queryClient.invalidateQueries({ queryKey: ['albums'] })
    },
  })

  return {
    save: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
  }
}
