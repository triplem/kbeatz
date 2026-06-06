import type { AlbumFilters, FilterOptions } from './album-filters'

interface FilterPanelProps {
  readonly options: FilterOptions
  readonly filters: AlbumFilters
  readonly onFiltersChange: (filters: AlbumFilters) => void
}

/**
 * Filter panel for the album grid.
 *
 * Provides multi-select checkboxes for genre, artist, composer,
 * and number inputs for year range. Operates on the in-memory
 * album list — no API calls.
 */
export function FilterPanel({ options, filters, onFiltersChange }: FilterPanelProps) {
  const toggleMultiSelect = (field: 'genres' | 'artists' | 'composers', value: string) => {
    const current = filters[field] as ReadonlyArray<string>
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    onFiltersChange({ ...filters, [field]: next })
  }

  const handleYearMin = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10)
    onFiltersChange({ ...filters, yearMin: isNaN(val) ? null : val })
  }

  const handleYearMax = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10)
    onFiltersChange({ ...filters, yearMax: isNaN(val) ? null : val })
  }

  return (
    <aside className="filter-panel" aria-label="Filter albums">
      {options.genres.length > 0 && (
        <section className="filter-panel__section">
          <h3 className="filter-panel__heading">Genre</h3>
          <ul className="filter-panel__list" role="group" aria-label="Genre filter">
            {options.genres.map((genre) => (
              <li key={genre}>
                <label className="filter-panel__option">
                  <input
                    type="checkbox"
                    checked={filters.genres.includes(genre)}
                    onChange={() => toggleMultiSelect('genres', genre)}
                  />
                  <span>{genre}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      {options.artists.length > 0 && (
        <section className="filter-panel__section">
          <h3 className="filter-panel__heading">Artist</h3>
          <ul className="filter-panel__list" role="group" aria-label="Artist filter">
            {options.artists.map((artist) => (
              <li key={artist}>
                <label className="filter-panel__option">
                  <input
                    type="checkbox"
                    checked={filters.artists.includes(artist)}
                    onChange={() => toggleMultiSelect('artists', artist)}
                  />
                  <span>{artist}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      {options.composers.length > 0 && (
        <section className="filter-panel__section">
          <h3 className="filter-panel__heading">Composer</h3>
          <ul className="filter-panel__list" role="group" aria-label="Composer filter">
            {options.composers.map((composer) => (
              <li key={composer}>
                <label className="filter-panel__option">
                  <input
                    type="checkbox"
                    checked={filters.composers.includes(composer)}
                    onChange={() => toggleMultiSelect('composers', composer)}
                  />
                  <span>{composer}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="filter-panel__section">
        <h3 className="filter-panel__heading">Year</h3>
        <div className="filter-panel__year-range">
          <label>
            <span className="filter-panel__label">From</span>
            <input
              type="number"
              aria-label="Year from"
              value={filters.yearMin ?? ''}
              onChange={handleYearMin}
              min={1900}
              max={2100}
              className="filter-panel__year-input"
            />
          </label>
          <label>
            <span className="filter-panel__label">To</span>
            <input
              type="number"
              aria-label="Year to"
              value={filters.yearMax ?? ''}
              onChange={handleYearMax}
              min={1900}
              max={2100}
              className="filter-panel__year-input"
            />
          </label>
        </div>
      </section>
    </aside>
  )
}
