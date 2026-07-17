import { useTranslation } from 'react-i18next'
import { Selector } from '@astryxdesign/core/Selector'
import { PAGE_SIZE_OPTIONS, isPageSize, type PageSize } from './pagination'

interface PageSizeSelectProps {
  readonly value: PageSize
  readonly onChange: (size: PageSize) => void
}

/**
 * Labelled select for the user-selectable page size (AC3).
 *
 * Offers the fixed set of {@link PAGE_SIZE_OPTIONS}. The chosen value is
 * persisted to localStorage by the parent via the pagination hook.
 */
export function PageSizeSelect({ value, onChange }: PageSizeSelectProps) {
  const { t } = useTranslation()

  const handleChange = (next: string): void => {
    const parsed = Number.parseInt(next, 10)
    if (isPageSize(parsed)) onChange(parsed)
  }

  return (
    <Selector
      label={t('pagination.pageSizeLabel')}
      value={String(value)}
      onChange={handleChange}
      options={PAGE_SIZE_OPTIONS.map((size) => ({
        value: String(size),
        label: t('pagination.pageSizeOption', { count: size }),
      }))}
    />
  )
}
