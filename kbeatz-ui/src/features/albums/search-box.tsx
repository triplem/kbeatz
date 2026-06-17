import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import IconButton from '@mui/material/IconButton'
import SearchIcon from '@mui/icons-material/Search'
import ClearIcon from '@mui/icons-material/Clear'
import type { AlbumFilters } from './album-filters'

const DEBOUNCE_MS = 150

interface SearchBoxProps {
  readonly filters: AlbumFilters
  readonly onFiltersChange: (filters: AlbumFilters) => void
}

/**
 * MUI free-text search box.
 *
 * Controlled: the visible value follows `filters.query` so an external reset
 * (e.g. "Clear all filters") immediately clears the field. The committed filter
 * update is debounced 150ms to avoid re-running the client-side filter on every
 * keystroke. A clear (x) button appears when non-empty.
 *
 * Accessibility: a real visible label (no placeholder-only labelling), a
 * search-role container, and a >=44px labelled clear button.
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
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setDisplayValue(value)
      if (debounceRef.current !== null) clearTimeout(debounceRef.current)
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
    <TextField
      id="album-search"
      type="search"
      role="search"
      label={t('searchBox.label')}
      placeholder={t('searchBox.placeholder')}
      value={displayValue}
      onChange={handleChange}
      size="small"
      fullWidth
      sx={{ maxWidth: { sm: 420 } }}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" aria-hidden="true" />
            </InputAdornment>
          ),
          endAdornment:
            displayValue !== '' ? (
              <InputAdornment position="end">
                <IconButton
                  aria-label={t('searchBox.clearAriaLabel')}
                  onClick={handleClear}
                  edge="end"
                  size="small"
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
        },
      }}
    />
  )
}
