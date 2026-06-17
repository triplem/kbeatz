import { describe, it, expect, beforeEach } from 'vitest'
import { renderWithProviders, THEMES } from '../test/render-helpers'
import { SettingsPage } from '../features/settings/settings-page'

/**
 * Visual-regression snapshots for the settings screen in both colour schemes.
 * Theme is seeded before mount so the ThemeToggle reflects the active scheme in
 * each snapshot.
 */
describe('SettingsPage visual regression', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  for (const theme of THEMES) {
    it(`matches the settings snapshot in ${theme} theme`, () => {
      const { container } = renderWithProviders(<SettingsPage />, { theme })
      expect(container).toMatchSnapshot()
    })
  }
})
