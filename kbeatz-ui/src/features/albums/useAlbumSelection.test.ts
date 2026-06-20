import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useAlbumSelection } from './useAlbumSelection'

describe('useAlbumSelection', () => {
  it('starts empty', () => {
    const { result } = renderHook(() => useAlbumSelection())
    expect(result.current.selectedIds).toEqual([])
    expect(result.current.selectedCount).toBe(0)
    expect(result.current.hasSelection).toBe(false)
  })

  it('toggles an album id on and off', () => {
    const { result } = renderHook(() => useAlbumSelection())

    act(() => { result.current.toggle('a') })
    expect(result.current.isSelected('a')).toBe(true)
    expect(result.current.selectedIds).toEqual(['a'])
    expect(result.current.hasSelection).toBe(true)

    act(() => { result.current.toggle('a') })
    expect(result.current.isSelected('a')).toBe(false)
    expect(result.current.selectedCount).toBe(0)
  })

  it('tracks multiple selected ids in insertion order', () => {
    const { result } = renderHook(() => useAlbumSelection())
    act(() => { result.current.toggle('a') })
    act(() => { result.current.toggle('b') })
    act(() => { result.current.toggle('c') })
    expect(result.current.selectedIds).toEqual(['a', 'b', 'c'])
    expect(result.current.selectedCount).toBe(3)
  })

  it('clears the entire selection', () => {
    const { result } = renderHook(() => useAlbumSelection())
    act(() => { result.current.toggle('a') })
    act(() => { result.current.toggle('b') })
    act(() => { result.current.clear() })
    expect(result.current.selectedIds).toEqual([])
    expect(result.current.hasSelection).toBe(false)
  })

  it('returns a stable reference when clearing an already-empty selection', () => {
    const { result } = renderHook(() => useAlbumSelection())
    const before = result.current.selectedIds
    act(() => { result.current.clear() })
    expect(result.current.selectedIds).toBe(before)
  })
})
