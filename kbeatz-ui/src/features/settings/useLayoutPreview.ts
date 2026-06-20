import { useQuery } from '@tanstack/react-query'
import { SettingsService, type LayoutPreview } from '../../api/generated'

interface UseLayoutPreviewResult {
  readonly preview: LayoutPreview | undefined
  readonly isPending: boolean
  readonly isError: boolean
}

/**
 * Fetch the live directory-layout preview for one album: its current directory and
 * the directory it would be moved to under the active template. The query is disabled
 * until an album is selected, so no request fires for an empty selection.
 *
 * Query key: ['layout-preview', albumId]
 *
 * @param albumId The selected album id, or null when no album is chosen.
 */
export function useLayoutPreview(albumId: string | null): UseLayoutPreviewResult {
  const { data: preview, isPending, isError } = useQuery<LayoutPreview, Error>({
    queryKey: ['layout-preview', albumId],
    queryFn: () => SettingsService.getLayoutPreview({ albumId: albumId ?? '' }),
    enabled: albumId !== null,
  })

  return {
    // When the query is disabled (no album selected) react-query reports isPending=true.
    // Treat "no selection" as not-pending so the UI does not show a spinner before a choice.
    preview,
    isPending: albumId !== null && isPending,
    isError,
  }
}
