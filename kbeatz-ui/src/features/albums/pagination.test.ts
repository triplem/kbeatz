import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  PAGE_SIZE_STORAGE_KEY,
  computeTotalPages,
  isPageSize,
  loadPageSize,
  pageSlice,
  parsePageParam,
  parseSizeParam,
  savePageSize,
} from './pagination'

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('isPageSize', () => {
  it('accepts allowed sizes and rejects others', () => {
    for (const size of PAGE_SIZE_OPTIONS) expect(isPageSize(size)).toBe(true)
    expect(isPageSize(50)).toBe(false)
    expect(isPageSize(0)).toBe(false)
    expect(isPageSize(-24)).toBe(false)
  })
})

describe('loadPageSize / savePageSize', () => {
  it('returns the default when nothing is stored', () => {
    expect(loadPageSize()).toBe(DEFAULT_PAGE_SIZE)
  })

  it('round-trips a valid stored value', () => {
    savePageSize(24)
    expect(localStorage.getItem(PAGE_SIZE_STORAGE_KEY)).toBe('24')
    expect(loadPageSize()).toBe(24)
  })

  it('falls back to the default for a corrupt stored value', () => {
    localStorage.setItem(PAGE_SIZE_STORAGE_KEY, 'garbage')
    expect(loadPageSize()).toBe(DEFAULT_PAGE_SIZE)
  })

  it('falls back to the default for a numeric-but-disallowed stored value', () => {
    localStorage.setItem(PAGE_SIZE_STORAGE_KEY, '13')
    expect(loadPageSize()).toBe(DEFAULT_PAGE_SIZE)
  })

  it('returns the default when localStorage read throws (private mode)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(loadPageSize()).toBe(DEFAULT_PAGE_SIZE)
  })

  it('does not throw when localStorage write throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(() => savePageSize(96)).not.toThrow()
  })
})

describe('parsePageParam', () => {
  it('returns 1 for null', () => {
    expect(parsePageParam(null, 5)).toBe(1)
  })

  it('returns 1 for non-numeric input', () => {
    expect(parsePageParam('abc', 5)).toBe(1)
  })

  it('clamps below 1 to 1', () => {
    expect(parsePageParam('0', 5)).toBe(1)
    expect(parsePageParam('-3', 5)).toBe(1)
  })

  it('clamps above totalPages to totalPages', () => {
    expect(parsePageParam('99', 5)).toBe(5)
  })

  it('returns a valid in-range page unchanged', () => {
    expect(parsePageParam('3', 5)).toBe(3)
  })
})

describe('parseSizeParam', () => {
  it('returns the fallback for null', () => {
    expect(parseSizeParam(null, 48)).toBe(48)
  })

  it('returns a valid size from the param', () => {
    expect(parseSizeParam('24', 48)).toBe(24)
  })

  it('returns the fallback for a disallowed size', () => {
    expect(parseSizeParam('17', 48)).toBe(48)
  })
})

describe('computeTotalPages', () => {
  it('is at least 1 for an empty list', () => {
    expect(computeTotalPages(0, 48)).toBe(1)
  })

  it('rounds up partial pages', () => {
    expect(computeTotalPages(100, 48)).toBe(3)
    expect(computeTotalPages(48, 48)).toBe(1)
    expect(computeTotalPages(49, 48)).toBe(2)
  })
})

describe('pageSlice', () => {
  const items = Array.from({ length: 10 }, (_, i) => i)

  it('returns the first page', () => {
    expect(pageSlice(items, 1, 4)).toEqual([0, 1, 2, 3])
  })

  it('returns a middle page', () => {
    expect(pageSlice(items, 2, 4)).toEqual([4, 5, 6, 7])
  })

  it('returns a short final page', () => {
    expect(pageSlice(items, 3, 4)).toEqual([8, 9])
  })

  it('returns empty for a page past the end', () => {
    expect(pageSlice(items, 99, 4)).toEqual([])
  })
})
