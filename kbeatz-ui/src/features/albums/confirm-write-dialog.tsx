import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './confirm-write-dialog.module.css'

interface ConfirmWriteDialogProps {
  /** Whether the dialog is open */
  readonly open: boolean
  /** Title of the album being modified */
  readonly albumTitle: string
  /** Number of FLAC files that will be written */
  readonly trackCount: number
  /** Called when the user confirms the write */
  readonly onConfirm: () => void
  /** Called when the user cancels (or presses Escape) */
  readonly onCancel: () => void
}

/**
 * ConfirmWriteDialog - accessible confirmation dialog for album tag writes.
 *
 * Shown before any PATCH /albums/{albumId} call to prevent accidental
 * overwriting of all FLAC files in an album directory. The operation is
 * destructive and cannot be undone.
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
export function ConfirmWriteDialog({
  open,
  albumTitle,
  trackCount,
  onConfirm,
  onCancel,
}: ConfirmWriteDialogProps) {
  const { t } = useTranslation()
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // Save the currently focused element so we can restore it on close
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement
      // Move focus into dialog (Cancel is the safe default for a destructive action)
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

      // Trap Tab focus within the dialog
      if (e.key === 'Tab') {
        const cancel = cancelButtonRef.current
        const confirm = confirmButtonRef.current
        if (!cancel || !confirm) return

        if (e.shiftKey) {
          if (document.activeElement === cancel) {
            e.preventDefault()
            confirm.focus()
          }
        } else {
          if (document.activeElement === confirm) {
            e.preventDefault()
            cancel.focus()
          }
        }
      }
    },
    [onCancel],
  )

  if (!open) return null

  const fileLabel = t('confirmDialog.fileCount', { count: trackCount })

  return (
    // role="presentation" marks the backdrop as a non-interactive layout wrapper
    // so assistive tech does not expose it as an unlabelled interactive element.
    // The onClick remains a mouse convenience for sighted users; keyboard users
    // dismiss via the Escape handler on the dialog itself (WCAG 4.1.2).
    <div
      role="presentation"
      className={styles.overlay}
      data-testid="confirm-dialog-overlay"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-body confirm-dialog-warning"
        className={styles.dialog}
        data-testid="confirm-dialog"
        onKeyDown={handleKeyDown}
        onClick={(e) => { e.stopPropagation() }}
      >
        <h2 id="confirm-dialog-title" className={styles.title}>
          {t('confirmDialog.title')}
        </h2>

        <p id="confirm-dialog-body" className={styles.body}>
          {t('confirmDialog.body', { count: fileLabel, albumTitle })}
        </p>

        <p id="confirm-dialog-warning" className={styles.warning} data-testid="confirm-dialog-warning">
          {t('confirmDialog.warning')}
        </p>

        <div className={styles.actions}>
          <button
            ref={cancelButtonRef}
            type="button"
            className={styles.cancelButton}
            data-testid="confirm-dialog-cancel"
            onClick={onCancel}
          >
            {t('confirmDialog.cancelButton')}
          </button>

          <button
            ref={confirmButtonRef}
            type="button"
            className={styles.confirmButton}
            data-testid="confirm-dialog-confirm"
            onClick={onConfirm}
          >
            {t('confirmDialog.confirmButton')}
          </button>
        </div>
      </div>
    </div>
  )
}
