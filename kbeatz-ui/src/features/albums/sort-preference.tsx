import { useTranslation } from 'react-i18next'
import { Selector } from '@astryxdesign/core/Selector'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Icon } from '@astryxdesign/core/Icon'
import { HStack } from '@astryxdesign/core/HStack'
import { ArrowUp, ArrowDown } from 'lucide-react'
import type { SortDirection, SortField } from './album-filters'

/** Sort field option values (domain constants) + their i18n label keys. */
const SORT_OPTIONS: ReadonlyArray<{ value: SortField; labelKey: string }> = [
  { value: 'albumArtist', labelKey: 'sortPreference.albumArtist' },
  { value: 'composer', labelKey: 'sortPreference.composer' },
]

interface SortPreferenceProps {
  readonly value: SortField
  readonly onChange: (sort: SortField) => void
  readonly direction: SortDirection
  readonly onDirectionChange: (dir: SortDirection) => void
}

/**
 * Sort preference selector.
 *
 * A labelled select ("Album Artist" / "Composer") plus a direction toggle
 * button (ascending/descending). Both values are persisted to localStorage by
 * the parent. The toggle has a state-aware aria-label.
 */
export function SortPreference({ value, onChange, direction, onDirectionChange }: SortPreferenceProps) {
  const { t } = useTranslation()

  const handleChange = (next: string): void => {
    if (next === 'albumArtist' || next === 'composer') {
      onChange(next)
    }
  }

  const handleDirectionToggle = (): void => {
    onDirectionChange(direction === 'asc' ? 'desc' : 'asc')
  }

  const directionLabel =
    direction === 'asc' ? t('sortPreference.sortAscending') : t('sortPreference.sortDescending')

  return (
    <HStack gap={1} align="end">
      <Selector
        label={t('sortPreference.label')}
        value={value}
        onChange={handleChange}
        options={SORT_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
      />
      <IconButton
        variant="secondary"
        onClick={handleDirectionToggle}
        label={directionLabel}
        tooltip={directionLabel}
        icon={<Icon icon={direction === 'asc' ? ArrowUp : ArrowDown} />}
      />
    </HStack>
  )
}
