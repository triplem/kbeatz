import { useCallback, useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'

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
    <Box
      role="presentation"
      data-testid="nav-guard-overlay"
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
        aria-describedby={bodyId}
        data-testid="nav-guard-dialog"
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
          {t('navGuard.title')}
        </Typography>

        <Typography id={bodyId} variant="body2" component="p" sx={{ mb: 3 }}>
          {t('navGuard.body')}
        </Typography>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button
            ref={cancelButtonRef}
            type="button"
            variant="outlined"
            color="inherit"
            data-testid="nav-guard-cancel"
            onClick={onCancel}
            sx={{ minHeight: 44 }}
          >
            {t('navGuard.cancelButton')}
          </Button>

          <Button
            ref={confirmButtonRef}
            type="button"
            variant="contained"
            color="error"
            data-testid="nav-guard-confirm"
            onClick={onConfirm}
            sx={{ minHeight: 44 }}
          >
            {t('navGuard.confirmButton')}
          </Button>
        </Box>
      </Box>
    </Box>
  )
}
