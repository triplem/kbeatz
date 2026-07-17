import { useCallback, useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@astryxdesign/core/Button'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'
import { DIALOG_OVERLAY_STYLE, DIALOG_PANEL_STYLE } from './dialog-styles'

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
 * Rebuilt on MUI primitives (Box overlay/panel, Typography, Button) on the
 * shared theme so it is theme-aware in light and dark modes. The dialog keeps
 * its own focus management, focus trap, body-scroll lock and Escape handling
 * rather than delegating to MUI's portalled Dialog, so the confirmation panel
 * renders inline alongside the page content it guards.
 *
 * Shown before any bulk PATCH /albums/{albumId}/tags call to prevent accidental
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
  // Stable, unique element IDs so a second dialog instance can never collide
  // (WCAG 4.1.1). Matches the useId() pattern used by the sibling dialogs.
  const baseId = useId()
  const titleId = `${baseId}-title`
  const bodyId = `${baseId}-body`
  const warningId = `${baseId}-warning`
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // Save the currently focused element so we can restore it on close
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement
      // Move focus into dialog (Cancel is the safe default for a destructive action)
      cancelButtonRef.current?.focus()
      return
    }
    // On the open->closed transition, restore focus to the trigger only if it is
    // still in the document; otherwise focus would silently fall to <body> and
    // the keyboard user would lose their place (WCAG 2.4.3).
    const previous = previousFocusRef.current
    if (previous && document.contains(previous)) {
      previous.focus()
    }
    previousFocusRef.current = null
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
      data-testid="confirm-dialog-overlay"
      onClick={onCancel}
      style={DIALOG_OVERLAY_STYLE}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={`${bodyId} ${warningId}`}
        data-testid="confirm-dialog"
        onKeyDown={handleKeyDown}
        onClick={(e) => { e.stopPropagation() }}
        style={DIALOG_PANEL_STYLE}
      >
        <div style={{ marginBottom: 8 }}>
          <Heading level={2} id={titleId}>
            {t('confirmDialog.title')}
          </Heading>
        </div>

        <p id={bodyId} style={{ margin: '0 0 8px' }}>
          <Text type="supporting">{t('confirmDialog.body', { count: fileLabel, albumTitle })}</Text>
        </p>

        <p
          id={warningId}
          data-testid="confirm-dialog-warning"
          style={{ margin: '0 0 24px', color: 'var(--color-error, #d6336c)', fontWeight: 600 }}
        >
          {t('confirmDialog.warning')}
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button
            ref={cancelButtonRef}
            type="button"
            variant="secondary"
            data-testid="confirm-dialog-cancel"
            onClick={onCancel}
            label={t('confirmDialog.cancelButton')}
          />

          <Button
            ref={confirmButtonRef}
            type="button"
            variant="destructive"
            data-testid="confirm-dialog-confirm"
            onClick={onConfirm}
            label={t('confirmDialog.confirmButton')}
          />
        </div>
      </div>
    </div>
  )
}
