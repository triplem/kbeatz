import { useTranslation } from 'react-i18next'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import type { SortDirection, SortField } from './album-filters'

interface SortPreferenceProps {
  readonly value: SortField
  readonly onChange: (sort: SortField) => void
  readonly direction: SortDirection
  readonly onDirectionChange: (dir: SortDirection) => void
}

/**
 * MUI sort preference selector.
 *
 * A labelled select ("Album Artist" / "Composer") plus a direction toggle
 * button (ascending/descending). Both values are persisted to localStorage by
 * the parent. The toggle has a state-aware aria-label and a >=44px hit area.
 */
export function SortPreference({ value, onChange, direction, onDirectionChange }: SortPreferenceProps) {
  const { t } = useTranslation()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const next = e.target.value
    if (next === 'albumArtist' || next === 'composer') {
      onChange(next)
    }
  }

  const handleDirectionToggle = (): void => {
    onDirectionChange(direction === 'asc' ? 'desc' : 'asc')
  }

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <TextField
        id="sort-by"
        select
        label={t('sortPreference.label')}
        value={value}
        onChange={handleChange}
        size="small"
        sx={{ minWidth: 160 }}
      >
        <MenuItem value="albumArtist">{t('sortPreference.albumArtist')}</MenuItem>
        <MenuItem value="composer">{t('sortPreference.composer')}</MenuItem>
      </TextField>
      <IconButton
        onClick={handleDirectionToggle}
        aria-label={direction === 'asc' ? t('sortPreference.sortAscending') : t('sortPreference.sortDescending')}
        sx={{ width: 44, height: 44 }}
      >
        {direction === 'asc' ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />}
      </IconButton>
    </Stack>
  )
}
