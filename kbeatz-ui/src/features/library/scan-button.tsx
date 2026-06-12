import { useTranslation } from 'react-i18next'
import { useTriggerScan } from './useTriggerScan'
import { useScanStatus } from './useScanStatus'
import styles from './scan-button.module.css'

export function ScanButton() {
  const { t } = useTranslation()
  const { trigger, isPending, error } = useTriggerScan()
  const { status } = useScanStatus()
  const isRunning = status?.state === 'RUNNING'
  const disabled = isRunning || isPending

  return (
    <div className={styles.scanButtonWrapper}>
      <button
        type="button"
        className={styles.scanButton}
        onClick={() => trigger()}
        disabled={disabled}
        aria-busy={disabled}
      >
        {isRunning ? t('scanButton.scanning') : t('scanButton.scan')}
      </button>
      {error !== null && (
        <p className={styles.scanError} role="alert">
          {t('scanButton.error')}
        </p>
      )}
    </div>
  )
}
