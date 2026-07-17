import { describe, it, expect } from 'vitest'
import { ON_COLOR, ROLE, SURFACE } from '../theme/palette'

/**
 * Visual-regression snapshot of the kbeatz brand palette tokens for each colour
 * scheme.
 *
 * The app themes via the Astryx neutral theme plus the kbeatz brand tokens in
 * kbeatz-tokens.css, which are selected by a root attribute, so the rendered
 * DOM markup is identical in light and dark mode (the per-screen DOM snapshots
 * therefore prove a screen renders cleanly in each theme, but the COLOUR
 * difference lives only in the stylesheet). This snapshot pins the palette.ts
 * source-of-truth values both schemes resolve to, so an accidental colour-token
 * change in either scheme is caught - the missing half of "both themes"
 * coverage. Keep palette.ts and kbeatz-tokens.css in sync.
 */
function paletteTokens(scheme: 'light' | 'dark') {
  return {
    scheme,
    primaryMain: ROLE[scheme].primary.main,
    secondaryMain: ROLE[scheme].secondary.main,
    errorMain: ROLE[scheme].error.main,
    successMain: ROLE[scheme].success.main,
    warningMain: ROLE[scheme].warning.main,
    backgroundDefault: SURFACE[scheme].background,
    backgroundPaper: SURFACE[scheme].paper,
    textPrimary: SURFACE[scheme].textPrimary,
    textSecondary: SURFACE[scheme].textSecondary,
    divider: SURFACE[scheme].divider,
    brandOn: ON_COLOR[scheme],
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
