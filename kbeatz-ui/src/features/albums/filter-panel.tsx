import { useTranslation } from 'react-i18next'
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput'
import { Text } from '@astryxdesign/core/Text'
import type { AlbumFilters, FilterOptions } from './album-filters'

interface FilterPanelProps {
  readonly options: FilterOptions
  readonly filters: AlbumFilters
  readonly onFiltersChange: (filters: AlbumFilters) => void
}

type MultiField = 'genres' | 'artists' | 'composers'

interface FilterSectionProps {
  readonly headingId: string
  readonly heading: string
  readonly values: ReadonlyArray<string>
  readonly selected: ReadonlyArray<string>
  readonly onToggle: (value: string) => void
}

function FilterSection({ headingId, heading, values, selected, onToggle }: FilterSectionProps) {
  if (values.length === 0) return null
  return (
    <section style={{ marginBottom: 16 }}>
      <div id={headingId} style={{ marginBottom: 4 }}>
        <Text weight="semibold">{heading}</Text>
      </div>
      <div role="group" aria-labelledby={headingId} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {values.map((value) => (
          <CheckboxInput
            key={value}
            label={value}
            value={selected.includes(value)}
            onChange={() => onToggle(value)}
            size="sm"
          />
        ))}
      </div>
    </section>
  )
}

/**
 * Filter panel for the album grid.
 *
 * Multi-select checkboxes for genre, artist, and composer. Operates on the
 * in-memory album set - no API calls. Renders nothing when there are no
 * options, so no empty container appears.
 *
 * Accessibility: each group is labelled by its heading via aria-labelledby;
 * checkboxes carry visible text labels.
 */
export function FilterPanel({ options, filters, onFiltersChange }: FilterPanelProps) {
  const { t } = useTranslation()

  const hasOptions =
    options.genres.length > 0 || options.artists.length > 0 || options.composers.length > 0
  if (!hasOptions) return null

  const toggle = (field: MultiField, value: string): void => {
    const current = filters[field]
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    onFiltersChange({ ...filters, [field]: next })
  }

  // Build the section descriptors in plain JS (field keys are domain constants,
  // not user-facing copy) so the JSX below carries no inline string literals.
  const sections: ReadonlyArray<Omit<FilterSectionProps, 'onToggle'> & { field: MultiField }> = [
    {
      field: 'genres',
      headingId: 'filter-genre-heading',
      heading: t('filterPanel.genre'),
      values: options.genres,
      selected: filters.genres,
    },
    {
      field: 'artists',
      headingId: 'filter-artist-heading',
      heading: t('filterPanel.artist'),
      values: options.artists,
      selected: filters.artists,
    },
    {
      field: 'composers',
      headingId: 'filter-composer-heading',
      heading: t('filterPanel.composer'),
      values: options.composers,
      selected: filters.composers,
    },
  ]

  const hasMultiValueSelection =
    filters.genres.length >= 2 || filters.artists.length >= 2 || filters.composers.length >= 2

  return (
    <aside aria-label={t('filterPanel.ariaLabel')} style={{ minWidth: 200 }}>
      {hasMultiValueSelection && (
        <div
          role="status"
          style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 'var(--radius-element, 8px)',
            background: 'var(--color-background-muted, rgba(128, 128, 128, 0.12))',
          }}
        >
          <Text type="supporting">{t('filterPanel.multiValueWarning')}</Text>
        </div>
      )}
      {sections.map(({ field, ...section }) => (
        <FilterSection key={field} {...section} onToggle={(value) => toggle(field, value)} />
      ))}
    </aside>
  )
}
