import { useCallback, useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './navigation-guard-dialog.module.css'

interface NavigationGuardDialogProps {
  /** Whether the dialog is open */
  readonly open: boolean
  /** Called when the user confirms leaving the page (dirty changes discarded) */
  readonly onConfirm: () => void
  /** Called when the user cancels (stays on page with dirty values intact) */
  readonly onCancel: () => void
}

/**
 * NavigationGuardDialog - warns the user that navigating away will discard unsaved changes.
 *
 * Shown by AlbumDetail when the user tries to navigate away (back button, browser back,
 * link click) while there are uncommitted dirty field changes. Uses its own CSS module
 * (navigation-guard-dialog.module.css) which mirrors the visual language of
 * ConfirmWriteDialog while keeping each component independently styled.
 *
 * Accessibility (WCAG AA):
 * - role="dialog" + aria-modal="true" + aria-labelledby + aria-describedby
 * - Focus moves to the Cancel button (safe default) when the dialog opens
 * - Focus returns to the triggering element when the dialog closes
 * - Escape dismisses as Cancel
 * - Tab focus is trapped inside the dialog while open
 * - Element IDs are generated with useId() to prevent collisions when multiple
 *   dialogs render simultaneously (e.g. nav guard + write confirm).
 */
export function NavigationGuardDialog({
  open,
  onConfirm,
  onCancel,
}: NavigationGuardDialogProps) {
  const { t } = useTranslation()
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const id = useId()
  const titleId = `${id}-title`
  const bodyId = `${id}-body`

  // Save the currently focused element and move focus into dialog when it opens.
  // Cancel is the safe default - the destructive action is leaving and losing changes.
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement
      cancelButtonRef.current?.focus()
    } else {
      previousFocusRef.current?.focus()
    }
  }, [open])

  // Prevent background scroll while the dialog is open
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

  return (
    <div
      role="presentation"
      className={styles.overlay}
      data-testid="nav-guard-overlay"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className={styles.dialog}
        data-testid="nav-guard-dialog"
        onKeyDown={handleKeyDown}
        onClick={(e) => { e.stopPropagation() }}
      >
        <h2 id={titleId} className={styles.title}>
          {t('navGuard.title')}
        </h2>

        <p id={bodyId} className={styles.body}>
          {t('navGuard.body')}
        </p>

        <div className={styles.actions}>
          <button
            ref={cancelButtonRef}
            type="button"
            className={styles.cancelButton}
            data-testid="nav-guard-cancel"
            onClick={onCancel}
          >
            {t('navGuard.cancelButton')}
          </button>

          <button
            ref={confirmButtonRef}
            type="button"
            className={styles.confirmButton}
            data-testid="nav-guard-confirm"
            onClick={onConfirm}
          >
            {t('navGuard.confirmButton')}
          </button>
        </div>
      </div>
    </div>
  )
}
