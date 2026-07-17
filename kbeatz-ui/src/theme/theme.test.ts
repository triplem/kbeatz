import { describe, expect, it } from 'vitest'
import { appTheme, COLOR_SCHEME_ATTR, THEME_STORAGE_KEY } from './theme'
import { BRAND, ON_COLOR, ROLE, SURFACE } from './palette'

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
  const hi = Math.max(lum(a), lum(b))
  const lo = Math.min(lum(a), lum(b))
  return (hi + 0.05) / (lo + 0.05)
}

describe('kbeatz theme configuration', () => {
  it('exposes the Astryx theme and the shared storage/attribute constants', () => {
    expect(appTheme).toBeDefined()
    expect(THEME_STORAGE_KEY).toBe('kbeatz-theme')
    // The kbeatz brand-token scheme and no-flash bootstrap select on this
    // attribute; keep it in sync with index.html and kbeatz-tokens.css.
    expect(COLOR_SCHEME_ATTR).toBe('data-kbeatz-color-scheme')
  })
})

describe('brand palette role mapping (ADR-013)', () => {
  it('maps the violet brand colour to the primary role (not default blue)', () => {
    expect(ROLE.light.primary.main.toLowerCase()).not.toBe('#1976d2')
    expect(ROLE.dark.primary.main.toUpperCase()).toBe(BRAND.violet)
  })

  it('maps pink to the secondary and error roles', () => {
    expect(ROLE.dark.secondary.main.toUpperCase()).toBe(BRAND.pink)
    expect(ROLE.dark.error.main.toUpperCase()).toBe(BRAND.pink)
    expect(ROLE.light.secondary.main.toUpperCase()).toBe(BRAND.pink)
  })

  it('maps teal to the success role', () => {
    expect(ROLE.light.success.main.toUpperCase()).toBe(BRAND.teal)
    expect(ROLE.dark.success.main.toUpperCase()).toBe(BRAND.teal)
  })

  it('maps amber to the warning role', () => {
    expect(ROLE.light.warning.main.toUpperCase()).toBe(BRAND.amber)
    expect(ROLE.dark.warning.main.toUpperCase()).toBe(BRAND.amber)
  })

  it('exposes accessible brand on-color tokens in both schemes', () => {
    expect(ON_COLOR.light.teal).toBeDefined()
    expect(ON_COLOR.light.amber).toBeDefined()
    expect(ON_COLOR.dark.teal).toBeDefined()
    expect(ON_COLOR.dark.amber).toBeDefined()
  })
})

describe('brand palette accessibility contrast (WCAG AA)', () => {
  it('provides >= 4.5:1 for on-color text in the light scheme on white', () => {
    const white = '#FFFFFF'
    expect(contrastRatio(ON_COLOR.light.teal, white)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(ON_COLOR.light.amber, white)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(ON_COLOR.light.violet, white)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(ON_COLOR.light.pink, white)).toBeGreaterThanOrEqual(4.5)
  })

  it('provides >= 4.5:1 for on-color text in the dark scheme on dark paper', () => {
    const darkPaper = SURFACE.dark.paper
    expect(contrastRatio(ON_COLOR.dark.teal, darkPaper)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(ON_COLOR.dark.amber, darkPaper)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(ON_COLOR.dark.violet, darkPaper)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(ON_COLOR.dark.pink, darkPaper)).toBeGreaterThanOrEqual(4.5)
  })

  it('provides >= 4.5:1 text on filled role buttons in the light scheme', () => {
    expect(
      contrastRatio(ROLE.light.primary.main, ROLE.light.primary.contrastText),
    ).toBeGreaterThanOrEqual(4.5)
    expect(
      contrastRatio(ROLE.light.error.main, ROLE.light.error.contrastText),
    ).toBeGreaterThanOrEqual(4.5)
    expect(
      contrastRatio(ROLE.light.warning.main, ROLE.light.warning.contrastText),
    ).toBeGreaterThanOrEqual(4.5)
    expect(
      contrastRatio(ROLE.light.success.main, ROLE.light.success.contrastText),
    ).toBeGreaterThanOrEqual(4.5)
  })

  it('provides >= 3:1 (large/UI) text on filled primary in the dark scheme', () => {
    expect(
      contrastRatio(ROLE.dark.primary.main, ROLE.dark.primary.contrastText),
    ).toBeGreaterThanOrEqual(3)
  })
})
