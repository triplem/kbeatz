import { describe, expect, it } from 'vitest'
import { ON_COLOR, ROLE, SURFACE } from './palette'

/**
 * WCAG 2.1 contrast verification for the brand palette (ADR-013 / #827 / #830).
 *
 * axe's `color-contrast` rule cannot run in jsdom (no layout/paint), so the
 * palette tokens are verified computationally here against the WCAG thresholds:
 *   - >= 4.5:1 for normal-size text  (SC 1.4.3 AA)
 *   - >= 3:1   for large text / UI components and graphics (SC 1.4.3 / 1.4.11)
 *
 * The ratio formula follows the WCAG relative-luminance definition.
 */

const AA_NORMAL_TEXT = 4.5
const AA_LARGE_OR_UI = 3

function srgbToLinear(channel: number): number {
  const c = channel / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
}

/** WCAG contrast ratio between two sRGB hex colours (>= 1, higher is better). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const lighter = Math.max(la, lb)
  const darker = Math.min(la, lb)
  return (lighter + 0.05) / (darker + 0.05)
}

describe('brand palette contrast (WCAG 2.1 AA)', () => {
  describe('light theme', () => {
    const { background, paper, textPrimary, textSecondary } = SURFACE.light

    it('primary/secondary body text meets 4.5:1 on both surfaces', () => {
      for (const surface of [background, paper]) {
        expect(contrastRatio(textPrimary, surface)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT)
        expect(contrastRatio(textSecondary, surface)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT)
      }
    })

    it('accessible on-colour foregrounds meet 4.5:1 on the paper surface', () => {
      for (const colour of Object.values(ON_COLOR.light)) {
        expect(contrastRatio(colour, paper)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT)
      }
    })

    it('role fills meet 4.5:1 against their contrastText', () => {
      for (const role of Object.values(ROLE.light)) {
        expect(contrastRatio(role.main, role.contrastText)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT)
      }
    })

    it('the primary fill meets 3:1 against the page background (UI component)', () => {
      expect(contrastRatio(ROLE.light.primary.main, background)).toBeGreaterThanOrEqual(AA_LARGE_OR_UI)
    })
  })

  describe('dark theme', () => {
    const { background, paper, textPrimary, textSecondary } = SURFACE.dark

    it('primary/secondary body text meets 4.5:1 on both surfaces', () => {
      for (const surface of [background, paper]) {
        expect(contrastRatio(textPrimary, surface)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT)
        expect(contrastRatio(textSecondary, surface)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT)
      }
    })

    it('accessible on-colour foregrounds meet 4.5:1 on the paper surface', () => {
      for (const colour of Object.values(ON_COLOR.dark)) {
        expect(contrastRatio(colour, paper)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT)
      }
    })

    it('role fills meet 4.5:1 against their contrastText', () => {
      for (const role of Object.values(ROLE.dark)) {
        expect(contrastRatio(role.main, role.contrastText)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT)
      }
    })

    it('the primary fill meets 3:1 against the page background (UI component)', () => {
      expect(contrastRatio(ROLE.dark.primary.main, background)).toBeGreaterThanOrEqual(AA_LARGE_OR_UI)
    })
  })
})
