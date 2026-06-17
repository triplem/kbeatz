import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import Typography from '@mui/material/Typography'
import type { ScanErrorEntry } from '../../api/generated'

interface ScanErrorsProps {
  readonly errors: ReadonlyArray<ScanErrorEntry>
  readonly totalErrors: number
  /**
   * Called when the user triggers a new scan so that the error banner can
   * reset itself. Pass the scan-trigger callback from the parent.
   */
  readonly onDismiss?: () => void
}

/**
 * ScanErrors - banner shown after a scan completes with per-album errors.
 *
 * Rebuilt on MUI feedback components: an error-severity Alert carrying the
 * summary, an expand/collapse toggle that reveals a List of individual error
 * entries, and a dismiss action. Each entry surfaces the album directory, the
 * failure reason and a remediation suggestion so operators get actionable
 * context (graceful degradation: a per-album failure does not fail the scan).
 *
 * Accessibility: the Alert carries role="alert"; the toggle exposes
 * aria-expanded/aria-controls; the dismiss button is labelled.
 */
export function ScanErrors({ errors, totalErrors, onDismiss }: ScanErrorsProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const listId = useId()

  if (dismissed || totalErrors === 0) {
    return null
  }

  const overflowCount = totalErrors - errors.length

  function handleDismiss() {
    setDismissed(true)
    onDismiss?.()
  }

  return (
    <Alert
      severity="error"
      onClose={handleDismiss}
      slotProps={{ closeButton: { 'aria-label': t('scanErrors.dismiss') } }}
      sx={{ alignItems: 'flex-start' }}
    >
      <AlertTitle sx={{ mb: 0.5 }}>{t('scanErrors.summary', { count: totalErrors })}</AlertTitle>
      <Button
        type="button"
        size="small"
        color="inherit"
        variant="text"
        onClick={() => { setExpanded((prev) => !prev) }}
        aria-expanded={expanded}
        aria-controls={listId}
        sx={{ minHeight: 44, px: 1 }}
      >
        {expanded ? t('scanErrors.hideDetails') : t('scanErrors.showDetails')}
      </Button>

      {expanded && (
        <List
          id={listId}
          dense
          aria-label={t('scanErrors.errorListLabel')}
          sx={{ pt: 0 }}
        >
          {errors.map((entry) => (
            <ListItem key={entry.albumDir} disableGutters sx={{ display: 'block' }}>
              <ListItemText
                primary={entry.albumDir}
                secondary={
                  <Box component="span" sx={{ display: 'block' }}>
                    <Typography component="span" variant="body2" sx={{ display: 'block' }}>
                      {entry.reason}
                    </Typography>
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {t('scanErrors.entrySuggestion', { suggestion: entry.suggestion })}
                    </Typography>
                  </Box>
                }
                slotProps={{ secondary: { component: 'span' } }}
              />
            </ListItem>
          ))}
          {overflowCount > 0 && (
            <ListItem disableGutters>
              <ListItemText
                primary={t('scanErrors.andMore', { count: overflowCount })}
                slotProps={{ primary: { variant: 'body2', color: 'text.secondary' } }}
              />
            </ListItem>
          )}
        </List>
      )}
    </Alert>
  )
}
