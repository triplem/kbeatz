import { useCallback, useEffect, useId, useRef, type CSSProperties } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'

/** Theme-aware overlay + panel styles for this inline (non-portalled) dialog. */
const OVERLAY_STYLE: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1300,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  background: 'rgba(0, 0, 0, 0.5)',
}

const PANEL_STYLE: CSSProperties = {
  width: '100%',
  maxWidth: 440,
  background: 'var(--color-background-primary, #fff)',
  color: 'var(--color-text-primary)',
  borderRadius: 'var(--radius-container, 12px)',
  boxShadow: 'var(--shadow-4, 0 12px 32px rgba(0, 0, 0, 0.25))',
  padding: 24,
}

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
    <div
      role="presentation"
      data-testid={testId !== undefined ? `${testId}-overlay` : undefined}
      onClick={onCancel}
      style={OVERLAY_STYLE}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        data-testid={testId}
        onKeyDown={handleKeyDown}
        onClick={(e) => { e.stopPropagation() }}
        style={PANEL_STYLE}
      >
        <div style={{ marginBottom: 8 }}>
          <Heading level={2} id={titleId}>
            {title}
          </Heading>
        </div>

        <p id={bodyId} style={{ margin: warning !== undefined ? '0 0 8px' : '0 0 24px' }}>
          <Text type="supporting">{body}</Text>
        </p>

        {warning !== undefined && (
          <p
            id={warningId}
            style={{ margin: '0 0 24px', color: 'var(--color-error, #d6336c)', fontWeight: 600 }}
          >
            {warning}
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button
            ref={cancelButtonRef}
            type="button"
            variant="secondary"
            data-testid={testId !== undefined ? `${testId}-cancel` : undefined}
            onClick={onCancel}
            label={cancelLabel}
          />
          <Button
            ref={confirmButtonRef}
            type="button"
            variant={confirmColor === 'error' ? 'destructive' : 'primary'}
            data-testid={testId !== undefined ? `${testId}-confirm` : undefined}
            onClick={onConfirm}
            label={confirmLabel}
          />
        </div>
      </div>
    </div>
  )
}
