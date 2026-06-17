import { afterEach, beforeEach, describe, it, vi } from 'vitest'
import { AppThemeProvider } from '../../theme'
import { SettingsPage } from './settings-page'
import { expectNoA11yViolationsInBothThemes } from '../../test/a11y'

function stubMatchMedia(): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: false,
      media: '',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  )
}

describe('SettingsPage accessibility', () => {
  beforeEach(() => {
    window.localStorage.clear()
    stubMatchMedia()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('has no WCAG 2.1 AA violations in light or dark theme', async () => {
    await expectNoA11yViolationsInBothThemes(() => (
      <AppThemeProvider>
        <SettingsPage />
      </AppThemeProvider>
    ))
  })
})
