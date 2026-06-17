import { describe, expect, it } from 'vitest'
import { theme } from './theme'
import { BRAND } from './palette'

/**
 * Compute the WCAG relative-luminance contrast ratio between two hex colours.
 */
function contrastRatio(a: string, b: string): number {
  const lum = (hex: string): number => {
    const c = hex.replace('#', '')
    const channel = (v: number): number => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    }
    const r = channel(parseInt(c.slice(0, 2), 16))
    const g = channel(parseInt(c.slice(2, 4), 16))
    const bch = channel(parseInt(c.slice(4, 6), 16))
    return 0.2126 * r + 0.7152 * g + 0.0722 * bch
  }
  const l1 = lum(a)
  const l2 = lum(b)
  const hi = Math.max(l1, l2)
  const lo = Math.min(l1, l2)
  return (hi + 0.05) / (lo + 0.05)
}

describe('theme palette role mapping', () => {
  const light = theme.colorSchemes.light?.palette
  const dark = theme.colorSchemes.dark?.palette

  it('should define both light and dark colour schemes', () => {
    expect(light).toBeDefined()
    expect(dark).toBeDefined()
  })

  it('should map the violet brand colour to the primary role (not default MUI blue)', () => {
    // Default MUI primary is #1976d2 - assert we are NOT using it.
    expect(light?.primary.main.toLowerCase()).not.toBe('#1976d2')
    expect(dark?.primary.main.toLowerCase()).not.toBe('#1976d2')
    // Dark primary is the raw violet brand; light primary is the accessible
    // darker violet used as a fill.
    expect(dark?.primary.main.toUpperCase()).toBe(BRAND.violet)
  })

  it('should map pink to secondary and error roles', () => {
    expect(dark?.secondary.main.toUpperCase()).toBe(BRAND.pink)
    expect(dark?.error.main.toUpperCase()).toBe(BRAND.pink)
    expect(light?.secondary.main.toUpperCase()).toBe(BRAND.pink)
  })

  it('should map teal to the success role', () => {
    expect(light?.success.main.toUpperCase()).toBe(BRAND.teal)
    expect(dark?.success.main.toUpperCase()).toBe(BRAND.teal)
  })

  it('should map amber to the warning role', () => {
    expect(light?.warning.main.toUpperCase()).toBe(BRAND.amber)
    expect(dark?.warning.main.toUpperCase()).toBe(BRAND.amber)
  })

  it('should expose accessible brand on-color tokens in both schemes', () => {
    expect(light?.brandOn.teal).toBeDefined()
    expect(light?.brandOn.amber).toBeDefined()
    expect(dark?.brandOn.teal).toBeDefined()
    expect(dark?.brandOn.amber).toBeDefined()
  })

  it('should be configured with CSS-variable colour schemes selected by data attribute', () => {
    // When cssVariables is enabled MUI populates theme.vars and a CSS var prefix,
    // and exposes a colorSchemeSelector. These are the observable markers.
    expect(theme.vars).toBeDefined()
    expect(theme.cssVarPrefix).toBeDefined()
    expect(theme.colorSchemeSelector).toBe('data')
  })
})

describe('theme accessibility contrast (WCAG AA)', () => {
  const light = theme.colorSchemes.light?.palette
  const dark = theme.colorSchemes.dark?.palette

  it('should provide >= 4.5:1 for accessible on-color text in the light scheme on white', () => {
    const white = '#FFFFFF'
    expect(contrastRatio(light?.brandOn.teal ?? '', white)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(light?.brandOn.amber ?? '', white)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(light?.brandOn.violet ?? '', white)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(light?.brandOn.pink ?? '', white)).toBeGreaterThanOrEqual(4.5)
  })

  it('should provide >= 4.5:1 for accessible on-color text in the dark scheme on dark paper', () => {
    const darkPaper = '#1E1B2E'
    expect(contrastRatio(dark?.brandOn.teal ?? '', darkPaper)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(dark?.brandOn.amber ?? '', darkPaper)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(dark?.brandOn.violet ?? '', darkPaper)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(dark?.brandOn.pink ?? '', darkPaper)).toBeGreaterThanOrEqual(4.5)
  })

  it('should provide >= 4.5:1 text on filled role buttons in the light scheme', () => {
    expect(
      contrastRatio(light?.primary.main ?? '', light?.primary.contrastText ?? ''),
    ).toBeGreaterThanOrEqual(4.5)
    expect(
      contrastRatio(light?.error.main ?? '', light?.error.contrastText ?? ''),
    ).toBeGreaterThanOrEqual(4.5)
    expect(
      contrastRatio(light?.warning.main ?? '', light?.warning.contrastText ?? ''),
    ).toBeGreaterThanOrEqual(4.5)
    expect(
      contrastRatio(light?.success.main ?? '', light?.success.contrastText ?? ''),
    ).toBeGreaterThanOrEqual(4.5)
  })

  it('should provide >= 3:1 (large/UI) text on filled primary in the dark scheme', () => {
    expect(
      contrastRatio(dark?.primary.main ?? '', dark?.primary.contrastText ?? ''),
    ).toBeGreaterThanOrEqual(3)
  })
})
