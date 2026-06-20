import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderWithProviders, THEMES } from '../test/render-helpers'
import { SettingsPage } from '../features/settings/settings-page'

// Stub the layout-settings/album queries so the snapshot captures a deterministic
// initial render without firing real network requests for the directory-layout section.
vi.mock('../api/generated', () => ({
  SettingsService: {
    getLayoutSettings: vi.fn(() => new Promise(() => undefined)),
    getLayoutPreview: vi.fn(() => new Promise(() => undefined)),
  },
  AlbumsService: {
    listAlbums: vi.fn(() => new Promise(() => undefined)),
  },
}))

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
