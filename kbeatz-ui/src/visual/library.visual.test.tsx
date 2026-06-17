import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderWithProviders, THEMES } from '../test/render-helpers'

// Stub the scan button so the library snapshot reflects page layout only and is
// not coupled to the scan data/query layer (mirrors the library a11y test).
vi.mock('../features/library/scan-button', () => ({
  ScanButton: () => (
    <button type="button" data-testid="scan-button-stub">
      Scan library
    </button>
  ),
}))

import { LibraryPage } from '../features/library/library-page'

/**
 * Visual-regression snapshots for the library screen in both colour schemes.
 */
describe('LibraryPage visual regression', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  for (const theme of THEMES) {
    it(`matches the library snapshot in ${theme} theme`, () => {
      const { container } = renderWithProviders(<LibraryPage />, { theme })
      expect(container).toMatchSnapshot()
    })
  }
})
