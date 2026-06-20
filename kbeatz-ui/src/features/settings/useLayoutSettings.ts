import { useQuery } from '@tanstack/react-query'
import { SettingsService, type LayoutSettings } from '../../api/generated'

interface UseLayoutSettingsResult {
  readonly settings: LayoutSettings | undefined
  readonly isPending: boolean
  readonly isError: boolean
}

/**
 * Fetch the active operator-configured directory-layout template and the tokens it
 * may reference. The template is read-only from the UI: this hook only reads it.
 *
 * Query key: ['layout-settings']
 */
export function useLayoutSettings(): UseLayoutSettingsResult {
  const { data: settings, isPending, isError } = useQuery<LayoutSettings, Error>({
    queryKey: ['layout-settings'],
    queryFn: () => SettingsService.getLayoutSettings(),
  })

  return { settings, isPending, isError }
}
