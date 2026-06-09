import { describe, it, expect } from 'vitest'
import i18n, { formatDate, formatDateTime } from './i18n'
import en from '../locales/en.json'

/**
 * Recursively collect all leaf key paths from an object.
 * e.g. { a: { b: 'val' } } -> ['a.b']
 */
function collectLeafKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return collectLeafKeys(value as Record<string, unknown>, fullKey)
    }
    return [fullKey]
  })
}

describe('i18n setup', () => {
  it('should be initialised with en language', () => {
    expect(i18n.language).toBe('en')
  })

  it('should resolve albumGrid.noResults key', () => {
    const result = i18n.t('albumGrid.noResults')
    expect(result).toBe(en.albumGrid.noResults)
    expect(result.length).toBeGreaterThan(0)
  })

  it('should resolve common keys', () => {
    expect(i18n.t('common.save')).toBe(en.common.save)
    expect(i18n.t('common.cancel')).toBe(en.common.cancel)
    expect(i18n.t('common.error')).toBe(en.common.error)
  })

  it('should resolve all leaf keys from en.json without undefined or empty values', () => {
    const leafKeys = collectLeafKeys(en as unknown as Record<string, unknown>)

    const missingOrEmpty = leafKeys.filter((key) => {
      const value = i18n.t(key)
      // i18next returns the key itself when missing
      return value === key || value === '' || value === undefined
    })

    expect(missingOrEmpty).toHaveLength(0)
  })

  it('should interpolate count parameter in collectionLabel', () => {
    const result = i18n.t('albumGrid.collectionLabel', { count: 42 })
    expect(result).toContain('42')
  })

  it('should interpolate album and artist in viewDetails', () => {
    const result = i18n.t('albumCard.viewDetails', {
      album: 'Kind of Blue',
      artist: 'Miles Davis',
    })
    expect(result).toContain('Kind of Blue')
    expect(result).toContain('Miles Davis')
  })
})

describe('formatDate', () => {
  it('returns empty string for undefined input', () => {
    expect(formatDate(undefined)).toBe('')
  })

  it('returns empty string for empty string input', () => {
    expect(formatDate('')).toBe('')
  })

  it('returns the raw string for invalid date', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date')
  })

  it('returns the raw string for malformed input without throwing', () => {
    expect(() => formatDate('circa 1970')).not.toThrow()
    expect(formatDate('circa 1970')).toBe('circa 1970')
  })

  it('returns bare year unchanged (no month or day artefacts)', () => {
    expect(formatDate('1978')).toBe('1978')
    expect(formatDate('2023')).toBe('2023')
  })

  it('formats year-month without day component', () => {
    const result = formatDate('1978-06')
    // The formatted result must contain the year
    expect(result).toContain('1978')
    // It must not be the raw ISO string
    expect(result).not.toBe('1978-06')
    // It must not contain a day number (no "-06" or "06" appearing as a day)
    expect(result).not.toMatch(/\b0?6\b.*\b1978\b.*\b\d{1,2}\b/)
  })

  it('formats full ISO date in locale-aware form', () => {
    const result = formatDate('2023-07-14')
    // Should not return the raw input or empty
    expect(result).not.toBe('')
    expect(result).not.toBe('2023-07-14')
    // Should contain the year
    expect(result).toContain('2023')
  })

  it('formats full ISO date - year always present', () => {
    const result2 = formatDate('1978-07-14')
    expect(result2).toContain('1978')
    expect(result2).not.toBe('1978-07-14')
  })

  it('formats year-month "1978-06" - year present in result', () => {
    const result = formatDate('1978-06')
    expect(result).toContain('1978')
  })

  it('returns formatted date+time for ISO datetime string', () => {
    const result = formatDate('2023-07-14T00:00:00Z')
    expect(result).toContain('2023')
    expect(result).not.toBe('2023-07-14T00:00:00Z')
  })
})

describe('formatDateTime', () => {
  it('returns empty string for undefined input', () => {
    expect(formatDateTime(undefined)).toBe('')
  })

  it('returns empty string for empty string input', () => {
    expect(formatDateTime('')).toBe('')
  })

  it('returns the raw string for invalid date', () => {
    expect(formatDateTime('not-a-datetime')).toBe('not-a-datetime')
  })

  it('returns the raw string for malformed input without throwing', () => {
    expect(() => formatDateTime('bad-ts')).not.toThrow()
    expect(formatDateTime('bad-ts')).toBe('bad-ts')
  })

  it('returns formatted date+time string for valid ISO datetime', () => {
    const result = formatDateTime('2023-05-15T10:30:00Z')
    // Should not return the raw input or empty
    expect(result).not.toBe('')
    expect(result).not.toBe('2023-05-15T10:30:00Z')
    // Should contain the year
    expect(result).toContain('2023')
  })

  it('formats UTC timestamp - year always present', () => {
    const result = formatDateTime('2026-06-09T20:31:20Z')
    expect(result).toContain('2026')
    expect(result).not.toBe('2026-06-09T20:31:20Z')
  })
})
