import '@testing-library/jest-dom'
import { configure } from '@testing-library/dom'
import './lib/i18n'
import { installStableIdSerializer } from './test/stable-id-serializer'

// Astryx injects StyleX stylesheets that use modern CSS (light-dark(), @scope,
// anchor-name) which jsdom's CSS parser cannot handle. jsdom logs a noisy
// "Could not parse CSS stylesheet" error for each one; it is harmless (jsdom
// performs no layout) but floods test output and slows runs. Swallow just that
// message while leaving all other console.error output intact.
const originalConsoleError = console.error.bind(console)
console.error = (...args: unknown[]): void => {
  const first = args[0]
  if (typeof first === 'string' && first.includes('Could not parse CSS stylesheet')) {
    return
  }
  if (first instanceof Error && first.message.includes('Could not parse CSS stylesheet')) {
    return
  }
  originalConsoleError(...args)
}

// jsdom requires a non-opaque origin (e.g. http://localhost) to activate
// localStorage. Without it, window.localStorage is undefined in the test
// environment. Provide a Map-backed stub so tests that call localStorage.clear /
// setItem / getItem work regardless of the jsdom URL setting.
if (typeof window !== 'undefined' && window.localStorage === undefined) {
  const store = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', {
    value: {
      clear: () => store.clear(),
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
      get length() { return store.size },
      key: (i: number) => [...store.keys()][i] ?? null,
    },
    writable: false,
    configurable: true,
  })
}

// Astryx layout components (AppShell, TopNav, ...) observe element size with
// ResizeObserver, which jsdom does not implement. Provide an inert stub so the
// components mount in the test environment; jsdom performs no layout, so the
// observer never needs to fire.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
}

// Several Astryx components read window.matchMedia (responsive behaviour, mobile
// nav). jsdom does not implement it, so provide a default no-match stub. Tests
// that assert breakpoint behaviour install their own matchMedia (see
// src/test/breakpoints.ts) which overrides this default.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  })
}

// Normalise React useId() values in every DOM snapshot so the visual-regression
// suites stay byte-stable across runs and worker assignment (#833).
installStableIdSerializer()

// The suite now includes CPU-heavy axe accessibility checks (#832) that run
// concurrently with the rest. Under that load the default 1000ms async-query
// timeout is too tight and causes spurious findBy/waitFor timeouts. Raise it so
// query timeouts reflect genuine failures, not scheduler starvation.
configure({ asyncUtilTimeout: 10000 })
