import { useCallback, useEffect, useId, useRef } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'

interface ConfirmDialogProps {
  /** Whether the dialog is open. */
  readonly open: boolean
  /** Dialog heading. */
  readonly title: string
  /** Body text describing the consequence of confirming. */
  readonly body: string
  /**
   * Optional emphasised warning line (rendered in the error colour, bold).
   * Use for irreversible/destructive actions.
   */
  readonly warning?: string
  /** Label for the confirm button. */
  readonly confirmLabel: string
  /** Label for the cancel button. */
  readonly cancelLabel: string
  /**
   * Colour of the confirm button. Defaults to "primary"; pass "error" for
   * destructive actions.
   */
  readonly confirmColor?: 'primary' | 'error'
  /** Called when the user confirms. */
  readonly onConfirm: () => void
  /** Called when the user cancels (button, backdrop click, or Escape). */
  readonly onCancel: () => void
  /** Optional test id forwarded to the dialog element. */
  readonly testId?: string
}

/**
 * ConfirmDialog - reusable, accessible confirmation dialog.
 *
 * Built on MUI Box/Typography/Button on the shared theme so it is theme-aware in
 * light and dark modes. It manages its own focus trap, focus restore, body-scroll
 * lock and Escape handling and renders inline (no portal) so the confirmation
 * panel sits alongside the content it guards.
 *
 * Accessibility (WCAG AA):
 * - role="dialog" + aria-modal="true" + aria-labelledby + aria-describedby
 * - Focus moves to Cancel (the safe default) when it opens
 * - Focus returns to the triggering element when it closes
 * - Escape dismisses as Cancel; Tab focus is trapped between the two buttons
 * - Backdrop carries role="presentation"; click-to-dismiss is a mouse convenience
 * - Buttons meet the 44px minimum target size
 */
export function ConfirmDialog({
  open,
  title,
  body,
  warning,
  confirmLabel,
  cancelLabel,
  confirmColor = 'primary',
  onConfirm,
  onCancel,
  testId,
}: ConfirmDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const bodyId = useId()
  const warningId = useId()

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement
      cancelButtonRef.current?.focus()
      return
    }
    // Restore focus to the trigger only if it is still connected, so focus is
    // never silently dropped to <body> when the trigger has unmounted (WCAG 2.4.3).
    const previous = previousFocusRef.current
    if (previous && document.contains(previous)) {
      previous.focus()
    }
    previousFocusRef.current = null
  }, [open])

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
      if (e.key === 'Tab') {
        const cancel = cancelButtonRef.current
        const confirm = confirmButtonRef.current
        if (!cancel || !confirm) return
        if (e.shiftKey) {
          if (document.activeElement === cancel) {
            e.preventDefault()
            confirm.focus()
          }
        } else if (document.activeElement === confirm) {
          e.preventDefault()
          cancel.focus()
        }
      }
    },
    [onCancel],
  )

  if (!open) return null

  const describedBy = warning !== undefined ? `${bodyId} ${warningId}` : bodyId

  return (
    <Box
      role="presentation"
      data-testid={testId !== undefined ? `${testId}-overlay` : undefined}
      onClick={onCancel}
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 'modal',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        bgcolor: 'rgba(0, 0, 0, 0.5)',
      }}
    >
      <Box
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        data-testid={testId}
        onKeyDown={handleKeyDown}
        onClick={(e) => { e.stopPropagation() }}
        sx={{
          width: '100%',
          maxWidth: 440,
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderRadius: 2,
          boxShadow: 24,
          p: 3,
        }}
      >
        <Typography id={titleId} variant="h6" component="h2" sx={{ mb: 1 }}>
          {title}
        </Typography>

        <Typography id={bodyId} variant="body2" component="p" sx={{ mb: warning !== undefined ? 1 : 3 }}>
          {body}
        </Typography>

        {warning !== undefined && (
          <Typography
            id={warningId}
            variant="body2"
            component="p"
            color="error"
            sx={{ mb: 3, fontWeight: 600 }}
          >
            {warning}
          </Typography>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button
            ref={cancelButtonRef}
            type="button"
            variant="outlined"
            color="inherit"
            data-testid={testId !== undefined ? `${testId}-cancel` : undefined}
            onClick={onCancel}
            sx={{ minHeight: 44 }}
          >
            {cancelLabel}
          </Button>
          <Button
            ref={confirmButtonRef}
            type="button"
            variant="contained"
            color={confirmColor}
            data-testid={testId !== undefined ? `${testId}-confirm` : undefined}
            onClick={onConfirm}
            sx={{ minHeight: 44 }}
          >
            {confirmLabel}
          </Button>
        </Box>
      </Box>
    </Box>
  )
}
