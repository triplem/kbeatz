import { describe, it, vi, beforeEach } from 'vitest'
import { AppThemeProvider } from '../../theme'
import { LibraryPage } from './library-page'
import { expectNoA11yViolationsInBothThemes } from '../../test/a11y'

// Stub the scan button so this a11y test stays focused on page layout and does
// not pull in the scan data/query layer.
vi.mock('./scan-button', () => ({
  ScanButton: () => <button type="button">Scan library</button>,
}))

describe('LibraryPage accessibility', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('has no WCAG 2.1 AA violations (both themes)', async () => {
    await expectNoA11yViolationsInBothThemes(() => (
      <AppThemeProvider>
        <LibraryPage />
      </AppThemeProvider>
    ))
  })
})
