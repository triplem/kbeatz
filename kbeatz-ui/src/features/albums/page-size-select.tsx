import { useTranslation } from 'react-i18next'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import { PAGE_SIZE_OPTIONS, isPageSize, type PageSize } from './pagination'

interface PageSizeSelectProps {
  readonly value: PageSize
  readonly onChange: (size: PageSize) => void
}

/**
 * Labelled MUI select for the user-selectable page size (AC3).
 *
 * Offers the fixed set of {@link PAGE_SIZE_OPTIONS}. The chosen value is
 * persisted to localStorage by the parent via the pagination hook.
 */
export function PageSizeSelect({ value, onChange }: PageSizeSelectProps) {
  const { t } = useTranslation()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const next = Number.parseInt(e.target.value, 10)
    if (isPageSize(next)) onChange(next)
  }

  return (
    <TextField
      id="page-size"
      select
      label={t('pagination.pageSizeLabel')}
      value={String(value)}
      onChange={handleChange}
      size="small"
      sx={{ minWidth: 130 }}
    >
      {PAGE_SIZE_OPTIONS.map((size) => (
        <MenuItem key={size} value={String(size)}>
          {t('pagination.pageSizeOption', { count: size })}
        </MenuItem>
      ))}
    </TextField>
  )
}
