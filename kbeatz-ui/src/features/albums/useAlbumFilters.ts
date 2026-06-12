import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  filtersFromParams,
  filtersToParams,
  type AlbumFilters,
} from './album-filters'

interface UseAlbumFiltersResult {
  readonly filters: AlbumFilters
  readonly setFilters: (next: AlbumFilters) => void
  readonly clearFilters: () => void
}

/**
 * Manage album filter state synced to URL search params via react-router.
 *
 * Replaces the previous `window.history.replaceState` approach in App.tsx
 * with the idiomatic react-router-dom `useSearchParams` hook so the URL
 * is kept in sync with the router's navigation stack.
 */
export function useAlbumFilters(): UseAlbumFiltersResult {
  const [searchParams, setSearchParams] = useSearchParams()

  const filters = filtersFromParams(searchParams)

  const setFilters = useCallback(
    (next: AlbumFilters) => {
      const params = filtersToParams(next)
      setSearchParams(params, { replace: true })
    },
    [setSearchParams],
  )

  const clearFilters = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true })
  }, [setSearchParams])

  return { filters, setFilters, clearFilters }
}
