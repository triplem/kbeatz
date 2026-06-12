import { describe, expect, it } from 'vitest'
import de from './de.json'
import en from './en.json'

/**
 * Recursively collect all dot-notation key paths from a nested object.
 * Example: { a: { b: 1 } } -> ['a.b']
 */
function collectKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return collectKeys(value as Record<string, unknown>, fullKey)
    }
    return [fullKey]
  })
}

describe('locale key parity', () => {
  const enKeys = collectKeys(en as Record<string, unknown>).sort()
  const deKeys = collectKeys(de as Record<string, unknown>).sort()

  it('de.json has the same keys as en.json', () => {
    const missingInDe = enKeys.filter((k) => !deKeys.includes(k))
    const extraInDe = deKeys.filter((k) => !enKeys.includes(k))

    expect(missingInDe, `Keys present in en.json but missing in de.json: ${missingInDe.join(', ')}`).toHaveLength(0)
    expect(extraInDe, `Keys present in de.json but missing in en.json: ${extraInDe.join(', ')}`).toHaveLength(0)
  })
})
