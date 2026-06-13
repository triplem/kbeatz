import { useTranslation } from 'react-i18next'
import type { SortDirection, SortField } from './album-filters'
import styles from './sort-preference.module.css'

interface SortPreferenceProps {
  readonly value: SortField
  readonly onChange: (sort: SortField) => void
  readonly direction: SortDirection
  readonly onDirectionChange: (dir: SortDirection) => void
}

/**
 * Sort preference selector for the album grid.
 *
 * Provides two options: "Album Artist" (default) and "Composer".
 * Also renders a direction toggle button (A-Z / Z-A) next to the select.
 * Both values are persisted to localStorage by the parent.
 */
export function SortPreference({ value, onChange, direction, onDirectionChange }: SortPreferenceProps) {
  const { t } = useTranslation()

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value
    if (next === 'albumArtist' || next === 'composer') {
      onChange(next)
    }
  }

  const handleDirectionToggle = () => {
    onDirectionChange(direction === 'asc' ? 'desc' : 'asc')
  }

  return (
    <div className={styles.sortPreference}>
      <label htmlFor="sort-by" className={styles.sortLabel}>
        {t('sortPreference.label')}
      </label>
      <select
        id="sort-by"
        value={value}
        onChange={handleChange}
        className={styles.sortSelect}
        aria-label={t('sortPreference.ariaLabel')}
      >
        <option value="albumArtist">{t('sortPreference.albumArtist')}</option>
        <option value="composer">{t('sortPreference.composer')}</option>
      </select>
      <button
        type="button"
        onClick={handleDirectionToggle}
        className={styles.directionToggle}
        aria-label={direction === 'asc' ? t('sortPreference.sortAscending') : t('sortPreference.sortDescending')}
      >
        {direction === 'asc' ? t('sortPreference.dirAsc') : t('sortPreference.dirDesc')}
      </button>
    </div>
  )
}
