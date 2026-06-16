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
 *
 * Shows a warning when 2+ values are selected within the same filter dimension,
 * because multi-value filtering is client-side (current page only).
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

  // Warn when any single dimension has 2+ active selections; in that case filtering
  // falls back to client-side page-only filtering.
  const hasMultiValueSelection =
    filters.genres.length >= 2 ||
    filters.artists.length >= 2 ||
    filters.composers.length >= 2

  return (
    <aside className={styles.filterPanel} aria-label={t('filterPanel.ariaLabel')}>
      {hasMultiValueSelection && (
        <p role="alert" className={styles.multiValueWarning}>
          {t('filterPanel.multiValueWarning')}
        </p>
      )}
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
