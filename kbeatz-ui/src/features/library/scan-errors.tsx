import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ScanErrorEntry } from '../../api/generated'
import styles from './scan-errors.module.css'

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
 * Banner shown after a scan completes with per-album errors.
 *
 * Displays a summary line (e.g. "3 albums could not be scanned"),
 * an expand/collapse toggle for individual error entries,
 * and a dismiss button.
 *
 * Note: the dismiss button is implemented inline here.
 * Once PR #569 (DismissibleBanner) merges, this should be refactored
 * to use that shared component.
 */
export function ScanErrors({ errors, totalErrors, onDismiss }: ScanErrorsProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || totalErrors === 0) {
    return null
  }

  const overflowCount = totalErrors - errors.length

  function handleDismiss() {
    setDismissed(true)
    onDismiss?.()
  }

  return (
    <div className={styles.scanErrors} role="alert">
      <div className={styles.header}>
        <span className={styles.summary}>
          {t('scanErrors.summary', { count: totalErrors })}
        </span>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.toggleButton}
            onClick={() => setExpanded((prev) => !prev)}
            aria-expanded={expanded}
          >
            {expanded ? t('scanErrors.hideDetails') : t('scanErrors.showDetails')}
          </button>
          <button
            type="button"
            className={styles.dismissButton}
            onClick={handleDismiss}
            aria-label={t('scanErrors.dismiss')}
          >
            &times;
          </button>
        </div>
      </div>

      {expanded && (
        <ul className={styles.errorList} aria-label="Scan error details">
          {errors.map((entry) => (
            <li key={entry.albumDir} className={styles.errorEntry}>
              <span className={styles.albumDir}>{entry.albumDir}</span>
              <span className={styles.reason}>{entry.reason}</span>
              <span className={styles.suggestion}>
                {t('scanErrors.entrySuggestion', { suggestion: entry.suggestion })}
              </span>
            </li>
          ))}
          {overflowCount > 0 && (
            <li className={styles.andMore}>
              {t('scanErrors.andMore', { count: overflowCount })}
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
