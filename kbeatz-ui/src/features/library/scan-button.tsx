import { useTranslation } from 'react-i18next'
import { Button } from '@astryxdesign/core/Button'
import { ErrorState } from '../../components'
import { useTriggerScan } from './useTriggerScan'
import { useScanStatus } from './useScanStatus'

/**
 * ScanButton - triggers a library scan.
 *
 * The button shows an inline loading spinner and is disabled while a scan is
 * already RUNNING or while the trigger mutation is in flight (Astryx Button
 * `isLoading`). A failed trigger surfaces an accessible error message.
 */
export function ScanButton() {
  const { t } = useTranslation()
  const { trigger, isPending, error } = useTriggerScan()
  const { status } = useScanStatus()
  const isRunning = status?.state === 'RUNNING'
  const disabled = isRunning || isPending

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
      <Button
        type="button"
        variant="primary"
        onClick={() => { trigger() }}
        isDisabled={disabled}
        isLoading={disabled}
        label={isRunning ? t('scanButton.scanning') : t('scanButton.scan')}
      />
      {error !== null && <ErrorState message={t('scanButton.error')} testId="scan-button-error" />}
    </div>
  )
}
