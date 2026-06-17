import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { THEME_STORAGE_KEY } from './theme'
import {
  getOsColorScheme,
  isColorScheme,
  readStoredColorScheme,
  resolveInitialColorScheme,
  storeColorScheme,
} from './theme-storage'

/** Stub window.matchMedia to report a given prefers-color-scheme: dark result. */
function stubMatchMedia(prefersDark: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: prefersDark,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  )
}

describe('isColorScheme', () => {
  it('should accept only light and dark', () => {
    expect(isColorScheme('light')).toBe(true)
    expect(isColorScheme('dark')).toBe(true)
  })

  it('should reject unknown, corrupt, and non-string values', () => {
    expect(isColorScheme('LIGHT')).toBe(false)
    expect(isColorScheme('blue')).toBe(false)
    expect(isColorScheme('')).toBe(false)
    expect(isColorScheme(null)).toBe(false)
    expect(isColorScheme(undefined)).toBe(false)
    expect(isColorScheme(42)).toBe(false)
    expect(isColorScheme({})).toBe(false)
  })
})

describe('getOsColorScheme', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should return dark when the OS prefers dark', () => {
    stubMatchMedia(true)
    expect(getOsColorScheme()).toBe('dark')
  })

  it('should return light when the OS prefers light', () => {
    stubMatchMedia(false)
    expect(getOsColorScheme()).toBe('light')
  })

  it('should fall back to light when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(getOsColorScheme()).toBe('light')
  })
})

describe('readStoredColorScheme', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('should return the persisted value when it is valid', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    expect(readStoredColorScheme()).toBe('dark')
  })

  it('should return null when nothing is stored', () => {
    expect(readStoredColorScheme()).toBeNull()
  })

  it('should return null for a corrupt/unknown stored value', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'rainbow')
    expect(readStoredColorScheme()).toBeNull()
  })

  it('should return null when localStorage access throws', () => {
    const spy = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('blocked')
      })
    expect(readStoredColorScheme()).toBeNull()
    spy.mockRestore()
  })
})

describe('resolveInitialColorScheme', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should prefer a valid persisted choice over the OS preference', () => {
    stubMatchMedia(true) // OS = dark
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light')
    expect(resolveInitialColorScheme()).toBe('light')
  })

  it('should follow the OS preference on a fresh load with no stored value', () => {
    stubMatchMedia(true)
    expect(resolveInitialColorScheme()).toBe('dark')
  })

  it('should fall back to the OS preference when the stored value is corrupt', () => {
    stubMatchMedia(false) // OS = light
    window.localStorage.setItem(THEME_STORAGE_KEY, 'not-a-theme')
    expect(resolveInitialColorScheme()).toBe('light')
  })
})

describe('storeColorScheme', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('should persist the chosen scheme', () => {
    storeColorScheme('dark')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('should not throw when localStorage is unavailable', () => {
    const spy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota exceeded')
      })
    expect(() => storeColorScheme('light')).not.toThrow()
    spy.mockRestore()
  })
})
