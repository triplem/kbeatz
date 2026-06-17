import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import { ErrorState } from '../../components'
import { useTriggerScan } from './useTriggerScan'
import { useScanStatus } from './useScanStatus'

/**
 * ScanButton - triggers a library scan.
 *
 * Rebuilt on MUI (Button with an inline progress spinner, ErrorState primitive).
 * The button is disabled while a scan is already RUNNING or while the trigger
 * mutation is in flight. A failed trigger surfaces an accessible error message.
 */
export function ScanButton() {
  const { t } = useTranslation()
  const { trigger, isPending, error } = useTriggerScan()
  const { status } = useScanStatus()
  const isRunning = status?.state === 'RUNNING'
  const disabled = isRunning || isPending

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-start' }}>
      <Button
        type="button"
        variant="contained"
        onClick={() => { trigger() }}
        disabled={disabled}
        aria-busy={disabled}
        startIcon={
          disabled ? <CircularProgress size={16} color="inherit" aria-hidden="true" /> : undefined
        }
        sx={{ minHeight: 44 }}
      >
        {isRunning ? t('scanButton.scanning') : t('scanButton.scan')}
      </Button>
      {error !== null && <ErrorState message={t('scanButton.error')} testId="scan-button-error" />}
    </Box>
  )
}
