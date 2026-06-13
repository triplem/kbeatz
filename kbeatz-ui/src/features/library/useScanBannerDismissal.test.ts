import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useScanBannerDismissal } from './useScanBannerDismissal'

const STORAGE_KEY = 'kbeatz.scanBanner.dismissedAt'
const COMPLETED_AT = '2026-06-09T20:31:20Z'
const NEW_COMPLETED_AT = '2026-06-10T08:00:00Z'

// Minimal localStorage mock that mirrors the Web Storage API.
function makeLocalStorageMock() {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
    get length() { return Object.keys(store).length },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  }
}

describe('useScanBannerDismissal', () => {
  let storageMock: ReturnType<typeof makeLocalStorageMock>

  beforeEach(() => {
    storageMock = makeLocalStorageMock()
    vi.stubGlobal('localStorage', storageMock)
  })

  it('banner is not dismissed on first render when localStorage has no entry', () => {
    const { result } = renderHook(() => useScanBannerDismissal(COMPLETED_AT))
    expect(result.current.isDismissed).toBe(false)
  })

  it('banner is dismissed on mount when localStorage already holds the same completedAt', () => {
    // Simulate a previous dismissal stored in localStorage (e.g. from a prior page load)
    storageMock.getItem.mockImplementation((key: string) =>
      key === STORAGE_KEY ? COMPLETED_AT : null,
    )

    const { result } = renderHook(() => useScanBannerDismissal(COMPLETED_AT))
    expect(result.current.isDismissed).toBe(true)
  })

  it('dismiss persists the completedAt to localStorage and sets isDismissed true', () => {
    const { result } = renderHook(() => useScanBannerDismissal(COMPLETED_AT))
    expect(result.current.isDismissed).toBe(false)

    act(() => {
      result.current.dismiss()
    })

    expect(result.current.isDismissed).toBe(true)
    expect(storageMock.setItem).toHaveBeenCalledWith(STORAGE_KEY, COMPLETED_AT)
  })

  it('banner shows again for a new completedAt even after prior scan was dismissed', () => {
    // Dismiss the first scan
    storageMock.getItem.mockImplementation((key: string) =>
      key === STORAGE_KEY ? COMPLETED_AT : null,
    )

    // A new scan completed with a different timestamp
    const { result } = renderHook(() => useScanBannerDismissal(NEW_COMPLETED_AT))
    expect(result.current.isDismissed).toBe(false)
  })

  it('does not throw when localStorage.getItem throws and falls back gracefully', () => {
    storageMock.getItem.mockImplementation(() => {
      throw new Error('localStorage is unavailable')
    })
    storageMock.setItem.mockImplementation(() => {
      throw new Error('localStorage is unavailable')
    })

    // Mount must not throw
    const { result } = renderHook(() => useScanBannerDismissal(COMPLETED_AT))
    expect(result.current.isDismissed).toBe(false)

    // Dismiss must not throw even when setItem fails
    expect(() => {
      act(() => {
        result.current.dismiss()
      })
    }).not.toThrow()

    // Banner is still dismissed for the current session
    expect(result.current.isDismissed).toBe(true)
  })

  it('IDLE state: banner is not dismissed when no completedAt has ever been stored', () => {
    // When scan state is IDLE, ScanProgress returns null before mounting
    // CompletedBanner. This test verifies the hook itself is safe to call with
    // an empty string (which would never match a stored timestamp), confirming
    // the hook does not create false-positive dismissals.
    const { result } = renderHook(() => useScanBannerDismissal(''))
    expect(result.current.isDismissed).toBe(false)
  })
})
