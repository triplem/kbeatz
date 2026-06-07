import { useCallback, useEffect, useRef, useState } from 'react'
import type { AlbumFilters } from './album-filters'

const DEBOUNCE_MS = 150

interface SearchBoxProps {
  readonly filters: AlbumFilters
  readonly onFiltersChange: (filters: AlbumFilters) => void
}

/**
 * Free-text search box.
 *
 * Controlled input — value is driven by `filters.query` so that external
 * filter resets (e.g. "Clear all filters") immediately clear the visible text.
 * Debounced 150ms — updates the `query` field in AlbumFilters only after
 * the user stops typing, to avoid excessive re-renders.
 * Shows a clear (×) button when the search box is non-empty.
 */
export function SearchBox({ filters, onFiltersChange }: SearchBoxProps) {
  // Local display value — updated immediately on input, debounces the filter update
  const [displayValue, setDisplayValue] = useState(filters.query)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync display value when filters.query changes externally (e.g., "Clear all")
  useEffect(() => {
    setDisplayValue(filters.query)
  }, [filters.query])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setDisplayValue(value)
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
    setDisplayValue('')
    onFiltersChange({ ...filters, query: '' })
  }, [filters, onFiltersChange])

  return (
    <div className="search-box" role="search">
      <input
        type="search"
        aria-label="Search albums"
        placeholder="Search by title, artist, composer, label…"
        value={displayValue}
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
