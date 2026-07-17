import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TextInput } from '@astryxdesign/core/TextInput'
import type { AlbumFilters } from './album-filters'

const DEBOUNCE_MS = 150

interface SearchBoxProps {
  readonly filters: AlbumFilters
  readonly onFiltersChange: (filters: AlbumFilters) => void
}

/**
 * Free-text search box.
 *
 * Controlled: the visible value follows `filters.query` so an external reset
 * (e.g. "Clear all filters") immediately clears the field. The committed filter
 * update is debounced 150ms to avoid re-running the client-side filter on every
 * keystroke; clearing to empty commits immediately. A clear (x) button appears
 * when non-empty (Astryx `hasClear`).
 *
 * Accessibility: a real visible label (no placeholder-only labelling), a
 * search-role container, and a leading search icon.
 */
export function SearchBox({ filters, onFiltersChange }: SearchBoxProps) {
  const { t } = useTranslation()
  const [displayValue, setDisplayValue] = useState(filters.query)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync display value when filters.query changes externally. During-render
  // adjustment avoids a cascading-render useEffect.
  const [prevQuery, setPrevQuery] = useState(filters.query)
  if (prevQuery !== filters.query) {
    setPrevQuery(filters.query)
    setDisplayValue(filters.query)
  }

  const handleChange = useCallback(
    (value: string) => {
      setDisplayValue(value)
      if (debounceRef.current !== null) clearTimeout(debounceRef.current)
      if (value === '') {
        // Clearing commits immediately so an emptied field resets the filter now.
        debounceRef.current = null
        onFiltersChange({ ...filters, query: '' })
        return
      }
      debounceRef.current = setTimeout(() => {
        onFiltersChange({ ...filters, query: value })
      }, DEBOUNCE_MS)
    },
    [filters, onFiltersChange],
  )

  return (
    <div role="search" style={{ width: '100%', maxWidth: 420 }}>
      <TextInput
        label={t('searchBox.label')}
        placeholder={t('searchBox.placeholder')}
        value={displayValue}
        onChange={handleChange}
        startIcon="search"
        hasClear
        size="sm"
      />
    </div>
  )
}
