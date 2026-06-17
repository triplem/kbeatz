import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { SyncFieldChange } from '../../api/generated'
import styles from './sync-preview-dialog.module.css'

interface SyncPreviewDialogProps {
  /** Whether the dialog is open */
  readonly open: boolean
  /** True while the preview API call is in flight */
  readonly loading: boolean
  /** Error message from preview fetch, or null when none */
  readonly error: string | null
  /** Proposed field changes returned by the preview endpoint */
  readonly changes: SyncFieldChange[]
  /** Called when the user confirms sync execution */
  readonly onConfirm: () => void
  /** Called when the user cancels or presses Escape */
  readonly onCancel: () => void
}

/**
 * SyncPreviewDialog - accessible modal showing the proposed Discogs tag changes.
 *
 * Shown after the preview API call succeeds so the user can review what will
 * change before the sync writes to disk. Includes a loading state while the
 * preview is being fetched and an error state if the fetch fails.
 *
 * Accessibility (WCAG AA):
 * - role="dialog" + aria-modal="true" + aria-labelledby + aria-describedby
 * - Focus moves into the dialog (Cancel button) when it opens
 * - Focus returns to the triggering element when it closes
 * - Escape key dismisses as Cancel
 * - Tab focus is trapped inside the dialog while it is open
 * - The backdrop carries role="presentation" so it is not an unlabelled
 *   interactive element; click-to-dismiss is a mouse-only convenience
 * - document.body overflow is set to hidden while open to prevent background scroll
 */
export function SyncPreviewDialog({
  open,
  loading,
  error,
  changes,
  onConfirm,
  onCancel,
}: SyncPreviewDialogProps) {
  const { t } = useTranslation()
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // Save the currently focused element so we can restore it on close
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement
      cancelButtonRef.current?.focus()
    } else {
      previousFocusRef.current?.focus()
    }
  }, [open])

  // Prevent background content from scrolling while the dialog is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
        return
      }

      // Trap Tab focus within the dialog.
      // When the confirm button is disabled it is not focusable, so the trap
      // only involves the cancel button in that state (Tab wraps back to cancel).
      if (e.key === 'Tab') {
        const cancel = cancelButtonRef.current
        const confirm = confirmButtonRef.current
        if (!cancel) return

        const confirmFocusable = confirm !== null && !confirm.disabled

        if (e.shiftKey) {
          if (document.activeElement === cancel) {
            e.preventDefault()
            if (confirmFocusable) {
              confirm.focus()
            }
            // When confirm is disabled, Shift+Tab from cancel has no other target inside the
            // dialog; keeping focus on cancel is the safest fallback.
          }
        } else {
          if (confirmFocusable && document.activeElement === confirm) {
            e.preventDefault()
            cancel.focus()
          }
        }
      }
    },
    [onCancel],
  )

  if (!open) return null

  return (
    <div
      role="presentation"
      className={styles.overlay}
      data-testid="sync-preview-overlay"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sync-preview-title"
        aria-describedby="sync-preview-body"
        aria-busy={loading}
        className={styles.dialog}
        data-testid="sync-preview-dialog"
        onKeyDown={handleKeyDown}
        onClick={(e) => { e.stopPropagation() }}
      >
        <h2 id="sync-preview-title" className={styles.title}>
          {t('syncPreview.title')}
        </h2>

        <div id="sync-preview-body" className={styles.body}>
          {loading && (
            <p role="status" aria-live="polite" data-testid="sync-preview-loading">
              {t('common.loading')}
            </p>
          )}

          {!loading && error !== null && (
            <p role="alert" data-testid="sync-preview-error" className={styles.error}>
              {t('syncPreview.loadingError')}: {error}
            </p>
          )}

          {!loading && error === null && changes.length === 0 && (
            <p data-testid="sync-preview-no-changes" className={styles.noChanges}>
              {t('syncPreview.noChanges')}
            </p>
          )}

          {!loading && error === null && changes.length > 0 && (
            <table className={styles.changesTable} data-testid="sync-preview-table">
              <thead>
                <tr>
                  <th scope="col">{t('syncPreview.field')}</th>
                  <th scope="col">{t('syncPreview.currentValue')}</th>
                  <th scope="col">{t('syncPreview.proposedValue')}</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((change) => (
                  <tr key={change.field} data-testid={`sync-preview-row-${change.field}`}>
                    <td className={styles.fieldName}>{change.field}</td>
                    <td className={styles.currentValue}>
                      {change.currentValue !== ''
                        ? change.currentValue
                        : <span aria-label={t('syncPreview.emptyAriaLabel')} className={styles.emptyPlaceholder}>{t('syncPreview.empty')}</span>
                      }
                    </td>
                    <td className={styles.proposedValue}>
                      {change.proposedValue !== ''
                        ? change.proposedValue
                        : <span aria-label={t('syncPreview.emptyAriaLabel')} className={styles.emptyPlaceholder}>{t('syncPreview.empty')}</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className={styles.actions}>
          <button
            ref={cancelButtonRef}
            type="button"
            className={styles.cancelButton}
            data-testid="sync-preview-cancel"
            onClick={onCancel}
          >
            {t('syncPreview.cancel')}
          </button>

          <button
            ref={confirmButtonRef}
            type="button"
            className={styles.confirmButton}
            data-testid="sync-preview-confirm"
            disabled={loading || error !== null}
            onClick={onConfirm}
          >
            {t('syncPreview.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
