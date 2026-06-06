import { useCallback, useRef } from 'react'
import type { AlbumFilters } from './album-filters'

const DEBOUNCE_MS = 150

interface SearchBoxProps {
  readonly filters: AlbumFilters
  readonly onFiltersChange: (filters: AlbumFilters) => void
}

/**
 * Free-text search box.
 *
 * Debounced 150ms — updates the `query` field in AlbumFilters only after
 * the user stops typing, to avoid excessive re-renders.
 * Shows a clear (×) button when the search box is non-empty.
 */
export function SearchBox({ filters, onFiltersChange }: SearchBoxProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current)
      }
      debounceRef.current = setTimeout(() => {
        onFiltersChange({ ...filters, query: value })
      }, DEBOUNCE_MS)
    },
    [filters, onFiltersChange],
  )

  const handleClear = useCallback(() => {
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    onFiltersChange({ ...filters, query: '' })
  }, [filters, onFiltersChange])

  return (
    <div className="search-box" role="search">
      <input
        type="search"
        aria-label="Search albums"
        placeholder="Search by title, artist, composer, label…"
        defaultValue={filters.query}
        onChange={handleChange}
        className="search-box__input"
      />
      {filters.query !== '' && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={handleClear}
          className="search-box__clear"
        >
          ×
        </button>
      )}
    </div>
  )
}
