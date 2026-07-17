import { useCallback, useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@astryxdesign/core/Button'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'
import { DIALOG_OVERLAY_STYLE, DIALOG_PANEL_STYLE } from './dialog-styles'

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
 * Rebuilt on MUI primitives (Box overlay/panel, Typography, Button) on the
 * shared theme so it is theme-aware in light and dark modes. Shown by
 * AlbumDetail when the user tries to navigate away (Back button, browser
 * back/forward, link click) while there are uncommitted dirty field changes.
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
      data-testid="nav-guard-overlay"
      onClick={onCancel}
      style={DIALOG_OVERLAY_STYLE}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        data-testid="nav-guard-dialog"
        onKeyDown={handleKeyDown}
        onClick={(e) => { e.stopPropagation() }}
        style={DIALOG_PANEL_STYLE}
      >
        <div style={{ marginBottom: 8 }}>
          <Heading level={2} id={titleId}>
            {t('navGuard.title')}
          </Heading>
        </div>

        <p id={bodyId} style={{ margin: '0 0 24px' }}>
          <Text type="supporting">{t('navGuard.body')}</Text>
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button
            ref={cancelButtonRef}
            type="button"
            variant="secondary"
            data-testid="nav-guard-cancel"
            onClick={onCancel}
            label={t('navGuard.cancelButton')}
          />

          <Button
            ref={confirmButtonRef}
            type="button"
            variant="destructive"
            data-testid="nav-guard-confirm"
            onClick={onConfirm}
            label={t('navGuard.confirmButton')}
          />
        </div>
      </div>
    </div>
  )
}
