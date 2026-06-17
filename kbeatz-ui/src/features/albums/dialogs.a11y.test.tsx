import { describe, it, vi, beforeEach } from 'vitest'
import { AppThemeProvider } from '../../theme'
import { ConfirmWriteDialog } from './confirm-write-dialog'
import { NavigationGuardDialog } from './navigation-guard-dialog'
import { expectNoA11yViolationsInBothThemes } from '../../test/a11y'

describe('Album dialog accessibility', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('ConfirmWriteDialog has no WCAG 2.1 AA violations when open (both themes)', async () => {
    await expectNoA11yViolationsInBothThemes(() => (
      <AppThemeProvider>
        <ConfirmWriteDialog
          open
          albumTitle="Kind of Blue"
          trackCount={9}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      </AppThemeProvider>
    ))
  })

  it('NavigationGuardDialog has no WCAG 2.1 AA violations when open (both themes)', async () => {
    await expectNoA11yViolationsInBothThemes(() => (
      <AppThemeProvider>
        <NavigationGuardDialog open onConfirm={vi.fn()} onCancel={vi.fn()} />
      </AppThemeProvider>
    ))
  })
})
