import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

interface BulkActionToolbarProps {
  /** Number of currently selected albums. */
  readonly selectedCount: number
  /** Start a directory-reorganize (RELAYOUT) change plan for the selection. */
  readonly onReorganize: () => void
  /** Clear the current selection. */
  readonly onClear: () => void
}

/**
 * BulkActionToolbar - actions for the currently selected albums.
 *
 * Shown only when at least one album is selected. Offers "Reorganize
 * directories" (a RELAYOUT change plan) and a clear-selection control. Rendered
 * as a labelled toolbar with a polite live count for screen readers.
 */
export function BulkActionToolbar({
  selectedCount,
  onReorganize,
  onClear,
}: BulkActionToolbarProps) {
  const { t } = useTranslation()

  return (
    <Box
      role="toolbar"
      aria-label={t('albumSelection.toolbarLabel')}
      data-testid="bulk-action-toolbar"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        flexWrap: 'wrap',
        p: 1.5,
        mb: 1,
        borderRadius: 1,
        bgcolor: 'action.selected',
      }}
    >
      <Typography
        component="p"
        role="status"
        aria-live="polite"
        data-testid="bulk-selected-count"
        sx={{ m: 0, fontWeight: 600 }}
      >
        {t('albumSelection.selectedCount', { count: selectedCount })}
      </Typography>
      <Box sx={{ flexGrow: 1 }} />
      <Stack direction="row" spacing={1}>
        <Button
          type="button"
          variant="contained"
          onClick={onReorganize}
          data-testid="bulk-reorganize-button"
          sx={{ minHeight: 44 }}
        >
          {t('albumSelection.reorganize')}
        </Button>
        <Button
          type="button"
          variant="outlined"
          color="inherit"
          onClick={onClear}
          data-testid="bulk-clear-button"
          sx={{ minHeight: 44 }}
        >
          {t('albumSelection.clear')}
        </Button>
      </Stack>
    </Box>
  )
}
