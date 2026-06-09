import { useTranslation } from 'react-i18next'
import type { SortField } from './album-filters'

interface SortPreferenceProps {
  readonly value: SortField
  readonly onChange: (sort: SortField) => void
}

/**
 * Sort preference selector for the album grid.
 *
 * Provides two options: "Album Artist" (default) and "Composer".
 * The selected value is persisted to localStorage by the parent.
 */
export function SortPreference({ value, onChange }: SortPreferenceProps) {
  const { t } = useTranslation()

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value
    if (next === 'albumArtist' || next === 'composer') {
      onChange(next)
    }
  }

  return (
    <div className="sort-preference">
      <label htmlFor="sort-by" className="sort-preference__label">
        {t('sortPreference.label')}
      </label>
      <select
        id="sort-by"
        value={value}
        onChange={handleChange}
        className="sort-preference__select"
        aria-label={t('sortPreference.ariaLabel')}
      >
        <option value="albumArtist">{t('sortPreference.albumArtist')}</option>
        <option value="composer">{t('sortPreference.composer')}</option>
      </select>
    </div>
  )
}
