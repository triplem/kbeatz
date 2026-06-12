import { useTranslation } from 'react-i18next'
import type { AlbumFilters, FilterOptions } from './album-filters'
import styles from './filter-panel.module.css'

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
 * album list - no API calls.
 */
export function FilterPanel({ options, filters, onFiltersChange }: FilterPanelProps) {
  const { t } = useTranslation()

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
    <aside className={styles.filterPanel} aria-label={t('filterPanel.ariaLabel')}>
      {options.genres.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.heading}>{t('filterPanel.genre')}</h3>
          <ul className={styles.list} role="group" aria-label={t('filterPanel.genreFilter')}>
            {options.genres.map((genre) => (
              <li key={genre}>
                <label className={styles.option}>
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
        <section className={styles.section}>
          <h3 className={styles.heading}>{t('filterPanel.artist')}</h3>
          <ul className={styles.list} role="group" aria-label={t('filterPanel.artistFilter')}>
            {options.artists.map((artist) => (
              <li key={artist}>
                <label className={styles.option}>
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
        <section className={styles.section}>
          <h3 className={styles.heading}>{t('filterPanel.composer')}</h3>
          <ul className={styles.list} role="group" aria-label={t('filterPanel.composerFilter')}>
            {options.composers.map((composer) => (
              <li key={composer}>
                <label className={styles.option}>
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

      <section className={styles.section}>
        <h3 className={styles.heading}>{t('filterPanel.year')}</h3>
        <div className={styles.yearRange}>
          <label>
            <span className={styles.label}>{t('filterPanel.yearFrom')}</span>
            <input
              type="number"
              aria-label={t('filterPanel.yearFrom')}
              value={filters.yearMin ?? ''}
              onChange={handleYearMin}
              min={1900}
              max={2100}
              className={styles.yearInput}
            />
          </label>
          <label>
            <span className={styles.label}>{t('filterPanel.yearTo')}</span>
            <input
              type="number"
              aria-label={t('filterPanel.yearTo')}
              value={filters.yearMax ?? ''}
              onChange={handleYearMax}
              min={1900}
              max={2100}
              className={styles.yearInput}
            />
          </label>
        </div>
      </section>
    </aside>
  )
}
