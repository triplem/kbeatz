import { render, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useScrollRestoration } from './useScrollRestoration'

function Harness({ ready }: { ready: boolean }) {
  useScrollRestoration('albums', ready)
  return null
}

beforeEach(() => {
  sessionStorage.clear()
  window.scrollTo = vi.fn()
  // jsdom does not implement rAF reliably for our needs; run callbacks sync.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0)
    return 0
  })
  Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useScrollRestoration', () => {
  it('does not restore when no value is stored', () => {
    render(<Harness ready={true} />)
    expect(window.scrollTo).not.toHaveBeenCalled()
  })

  it('restores the stored scroll position once content is ready', () => {
    sessionStorage.setItem('kbeatz.scroll.albums', '420')
    render(<Harness ready={true} />)
    expect(window.scrollTo).toHaveBeenCalledWith(0, 420)
  })

  it('does not restore until ready becomes true', () => {
    sessionStorage.setItem('kbeatz.scroll.albums', '420')
    const { rerender } = render(<Harness ready={false} />)
    expect(window.scrollTo).not.toHaveBeenCalled()
    rerender(<Harness ready={true} />)
    expect(window.scrollTo).toHaveBeenCalledWith(0, 420)
  })

  it('persists the current scroll position on unmount', () => {
    Object.defineProperty(window, 'scrollY', { value: 250, writable: true, configurable: true })
    render(<Harness ready={true} />)
    cleanup()
    expect(sessionStorage.getItem('kbeatz.scroll.albums')).toBe('250')
  })

  it('ignores a stored value of 0', () => {
    sessionStorage.setItem('kbeatz.scroll.albums', '0')
    render(<Harness ready={true} />)
    expect(window.scrollTo).not.toHaveBeenCalled()
  })

  it('degrades gracefully when sessionStorage throws on read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(() => render(<Harness ready={true} />)).not.toThrow()
  })
})
