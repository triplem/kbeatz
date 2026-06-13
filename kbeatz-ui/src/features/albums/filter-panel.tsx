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
 * Provides multi-select checkboxes for genre, artist, and composer.
 * Operates on the in-memory album list - no API calls.
 *
 * Returns null when all option lists are empty so no container is rendered.
 */
export function FilterPanel({ options, filters, onFiltersChange }: FilterPanelProps) {
  const { t } = useTranslation()

  // Do not render an empty container when there are no filter options available.
  const hasOptions =
    options.genres.length > 0 || options.artists.length > 0 || options.composers.length > 0
  if (!hasOptions) {
    return null
  }

  const toggleMultiSelect = (field: 'genres' | 'artists' | 'composers', value: string) => {
    const current = filters[field] as ReadonlyArray<string>
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    onFiltersChange({ ...filters, [field]: next })
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

    </aside>
  )
}
