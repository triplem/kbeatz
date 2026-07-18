import type { CSSProperties } from 'react'

/**
 * Shared inline styles for the app's custom inline modal dialogs
 * (ConfirmWriteDialog, NavigationGuardDialog). These dialogs deliberately render
 * inline (not portalled) and manage their own focus trap, so they only need a
 * theme-aware overlay + panel surface built from Astryx tokens.
 */
export const DIALOG_OVERLAY_STYLE: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1300,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  background: 'rgba(0, 0, 0, 0.5)',
}

export const DIALOG_PANEL_STYLE: CSSProperties = {
  width: '100%',
  maxWidth: 440,
  background: 'var(--color-background-surface, #fff)',
  color: 'var(--color-text-primary)',
  borderRadius: 'var(--radius-container, 12px)',
  boxShadow: 'var(--shadow-high, 0 12px 32px rgba(0, 0, 0, 0.25))',
  padding: 24,
}
