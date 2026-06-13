import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useScanBannerDismissal } from './useScanBannerDismissal'

const STORAGE_KEY = 'kbeatz.scanBanner.dismissedAt'
const COMPLETED_AT = '2026-06-09T20:31:20Z'
const NEW_COMPLETED_AT = '2026-06-10T08:00:00Z'

// Minimal localStorage mock that mirrors the Web Storage API.
// Return types are explicit so TypeScript can verify them in strict mode.
function makeLocalStorageMock(initial: Record<string, string> = {}): Storage {
  const store: Record<string, string> = { ...initial }
  return {
    getItem: vi.fn((key: string): string | null => store[key] ?? null),
    setItem: vi.fn((key: string, value: string): void => { store[key] = value }),
    removeItem: vi.fn((key: string): void => { delete store[key] }),
    clear: vi.fn((): void => { Object.keys(store).forEach(k => { delete store[k] }) }),
    get length(): number { return Object.keys(store).length },
    key: vi.fn((index: number): string | null => Object.keys(store)[index] ?? null),
  }
}

describe('useScanBannerDismissal', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeLocalStorageMock())
  })

  it('banner is not dismissed on first render when localStorage has no entry', () => {
    const { result } = renderHook(() => useScanBannerDismissal(COMPLETED_AT))
    expect(result.current.isDismissed).toBe(false)
  })

  it('banner is dismissed on mount when localStorage already holds the same completedAt', () => {
    // Simulate a previous dismissal stored in localStorage (e.g. from a prior page load)
    vi.stubGlobal('localStorage', makeLocalStorageMock({ [STORAGE_KEY]: COMPLETED_AT }))

    const { result } = renderHook(() => useScanBannerDismissal(COMPLETED_AT))
    expect(result.current.isDismissed).toBe(true)
  })

  it('dismiss persists the completedAt to localStorage and sets isDismissed true', () => {
    const storageMock = makeLocalStorageMock()
    vi.stubGlobal('localStorage', storageMock)

    const { result } = renderHook(() => useScanBannerDismissal(COMPLETED_AT))
    expect(result.current.isDismissed).toBe(false)

    act(() => {
      result.current.dismiss()
    })

    expect(result.current.isDismissed).toBe(true)
    expect(storageMock.setItem).toHaveBeenCalledWith(STORAGE_KEY, COMPLETED_AT)
  })

  it('banner shows again for a new completedAt even after prior scan was dismissed', () => {
    // Previous scan dismissed - storage holds the OLD completedAt
    vi.stubGlobal('localStorage', makeLocalStorageMock({ [STORAGE_KEY]: COMPLETED_AT }))

    // A new scan completed with a different timestamp
    const { result } = renderHook(() => useScanBannerDismissal(NEW_COMPLETED_AT))
    expect(result.current.isDismissed).toBe(false)
  })

  it('does not throw when localStorage throws and falls back gracefully', () => {
    const brokenStorage: Storage = {
      getItem: vi.fn((): string | null => { throw new Error('localStorage is unavailable') }),
      setItem: vi.fn((): void => { throw new Error('localStorage is unavailable') }),
      removeItem: vi.fn((): void => { throw new Error('localStorage is unavailable') }),
      clear: vi.fn((): void => { throw new Error('localStorage is unavailable') }),
      get length(): number { return 0 },
      key: vi.fn((): string | null => null),
    }
    vi.stubGlobal('localStorage', brokenStorage)

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


  it('banner is NOT dismissed when localStorage holds an empty string and completedAt is non-empty', () => {
    // An empty string stored by a prior session (e.g. a bug wrote '' instead of a timestamp)
    // must NOT suppress a real scan completion banner.
    // readDismissedAt() returns '' and completedAt is a real timestamp - they differ, so isDismissed is false.
    vi.stubGlobal('localStorage', makeLocalStorageMock({ [STORAGE_KEY]: '' }))

    const { result } = renderHook(() => useScanBannerDismissal(COMPLETED_AT))
    expect(result.current.isDismissed).toBe(false)
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
