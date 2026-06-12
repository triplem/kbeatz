import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { useAlbumFilters } from './useAlbumFilters'
import { EMPTY_FILTERS, type AlbumFilters } from './album-filters'

function makeWrapper(initialSearch = '') {
  const initialEntry = initialSearch ? `/?${initialSearch}` : '/'
  return ({ children }: { children: React.ReactNode }) =>
    createElement(MemoryRouter, { initialEntries: [initialEntry] }, children)
}

describe('useAlbumFilters', () => {
  it('returns EMPTY_FILTERS when no search params are present', () => {
    const { result } = renderHook(() => useAlbumFilters(), { wrapper: makeWrapper() })
    expect(result.current.filters).toEqual(EMPTY_FILTERS)
  })

  it('parses genre from URL search params', () => {
    const { result } = renderHook(() => useAlbumFilters(), {
      wrapper: makeWrapper('genre=Jazz'),
    })
    expect(result.current.filters.genres).toEqual(['Jazz'])
  })

  it('parses multiple genres from URL search params', () => {
    const { result } = renderHook(() => useAlbumFilters(), {
      wrapper: makeWrapper('genre=Jazz&genre=Classical'),
    })
    expect(result.current.filters.genres).toEqual(['Jazz', 'Classical'])
  })

  it('parses yearMin and yearMax from URL', () => {
    const { result } = renderHook(() => useAlbumFilters(), {
      wrapper: makeWrapper('yearMin=1950&yearMax=1970'),
    })
    expect(result.current.filters.yearMin).toBe(1950)
    expect(result.current.filters.yearMax).toBe(1970)
  })

  it('parses free-text query from URL', () => {
    const { result } = renderHook(() => useAlbumFilters(), {
      wrapper: makeWrapper('q=miles+davis'),
    })
    expect(result.current.filters.query).toBe('miles davis')
  })

  it('setFilters updates the URL search params', () => {
    const { result } = renderHook(() => useAlbumFilters(), { wrapper: makeWrapper() })

    const newFilters: AlbumFilters = {
      ...EMPTY_FILTERS,
      genres: ['Jazz'],
      query: 'miles',
    }

    act(() => {
      result.current.setFilters(newFilters)
    })

    expect(result.current.filters.genres).toEqual(['Jazz'])
    expect(result.current.filters.query).toBe('miles')
  })

  it('clearFilters resets all filters to empty', () => {
    const { result } = renderHook(() => useAlbumFilters(), {
      wrapper: makeWrapper('genre=Jazz&q=miles'),
    })

    expect(result.current.filters.genres).toEqual(['Jazz'])

    act(() => {
      result.current.clearFilters()
    })

    expect(result.current.filters).toEqual(EMPTY_FILTERS)
  })

  it('returns named fields (not a tuple)', () => {
    const { result } = renderHook(() => useAlbumFilters(), { wrapper: makeWrapper() })
    expect(result.current).toHaveProperty('filters')
    expect(result.current).toHaveProperty('setFilters')
    expect(result.current).toHaveProperty('clearFilters')
    expect(Array.isArray(result.current)).toBe(false)
  })
})
