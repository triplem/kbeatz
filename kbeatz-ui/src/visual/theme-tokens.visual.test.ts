import { describe, it, expect } from 'vitest'
import { theme } from '../theme/theme'

/**
 * Visual-regression snapshot of the resolved theme palette tokens for each
 * colour scheme.
 *
 * Because the app themes via MUI CSS variables selected by a root attribute,
 * the rendered DOM markup is identical in light and dark mode (the per-screen
 * DOM snapshots therefore prove a screen renders cleanly in each theme, but the
 * COLOUR difference lives only in the stylesheet). This snapshot pins the actual
 * palette values both schemes resolve to, so an accidental colour-token change
 * in either theme is caught - the missing half of "both themes" coverage.
 */
function paletteTokens(scheme: 'light' | 'dark') {
  const colorScheme = theme.colorSchemes[scheme]
  if (!colorScheme) {
    throw new Error(`Theme is missing the ${scheme} colour scheme`)
  }
  const p = colorScheme.palette
  return {
    mode: p.mode,
    primaryMain: p.primary.main,
    secondaryMain: p.secondary.main,
    errorMain: p.error.main,
    successMain: p.success.main,
    warningMain: p.warning.main,
    backgroundDefault: p.background.default,
    backgroundPaper: p.background.paper,
    textPrimary: p.text.primary,
    textSecondary: p.text.secondary,
    divider: p.divider,
    brandOn: p.brandOn,
  }
}

describe('theme palette tokens visual regression', () => {
  it('matches the light scheme palette snapshot', () => {
    expect(paletteTokens('light')).toMatchSnapshot()
  })

  it('matches the dark scheme palette snapshot', () => {
    expect(paletteTokens('dark')).toMatchSnapshot()
  })

  it('light and dark resolve to different background and text tokens', () => {
    const light = paletteTokens('light')
    const dark = paletteTokens('dark')
    expect(dark.backgroundDefault).not.toBe(light.backgroundDefault)
    expect(dark.textPrimary).not.toBe(light.textPrimary)
  })
})
