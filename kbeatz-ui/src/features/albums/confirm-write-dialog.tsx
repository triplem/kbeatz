import { useCallback, useEffect, useRef } from 'react'

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
 * ConfirmWriteDialog — accessible confirmation dialog for album tag writes.
 *
 * Shown before any PATCH /albums/{albumId} call to prevent accidental
 * overwriting of all FLAC files in an album directory. The operation is
 * destructive and cannot be undone.
 *
 * Accessibility (WCAG AA):
 * - role="dialog" + aria-modal="true" + aria-labelledby
 * - Focus moves into the dialog (Cancel button) when it opens
 * - Focus returns to the triggering element when it closes
 * - Escape key dismisses as Cancel
 * - Tab focus is trapped inside the dialog while it is open
 */
export function ConfirmWriteDialog({
  open,
  albumTitle,
  trackCount,
  onConfirm,
  onCancel,
}: ConfirmWriteDialogProps) {
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

  const fileLabel = trackCount === 1 ? '1 FLAC file' : `${trackCount.toString()} FLAC files`

  return (
    <div
      className="confirm-dialog-overlay"
      data-testid="confirm-dialog-overlay"
      // Clicking the backdrop cancels — common UX convention
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="confirm-dialog"
        data-testid="confirm-dialog"
        onKeyDown={handleKeyDown}
        // Stop overlay click from triggering inside the panel
        onClick={(e) => { e.stopPropagation() }}
      >
        <h2 id="confirm-dialog-title" className="confirm-dialog__title">
          Write tags to FLAC files?
        </h2>

        <p className="confirm-dialog__body">
          Write changes to all <strong>{fileLabel}</strong> in{' '}
          <strong>&ldquo;{albumTitle}&rdquo;</strong>?
        </p>

        <p className="confirm-dialog__warning" data-testid="confirm-dialog-warning">
          This cannot be undone.
        </p>

        <div className="confirm-dialog__actions">
          <button
            ref={cancelButtonRef}
            type="button"
            className="confirm-dialog__cancel"
            data-testid="confirm-dialog-cancel"
            onClick={onCancel}
          >
            Cancel
          </button>

          <button
            ref={confirmButtonRef}
            type="button"
            className="confirm-dialog__confirm confirm-dialog__confirm--destructive"
            data-testid="confirm-dialog-confirm"
            onClick={onConfirm}
          >
            Write tags
          </button>
        </div>
      </div>
    </div>
  )
}
