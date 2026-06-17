import '@testing-library/jest-dom'
import { configure } from '@testing-library/dom'
import './lib/i18n'
import { installStableIdSerializer } from './test/stable-id-serializer'

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

// Normalise React useId() values in every DOM snapshot so the visual-regression
// suites stay byte-stable across runs and worker assignment (#833).
installStableIdSerializer()

// The suite now includes CPU-heavy axe accessibility checks (#832) that run
// concurrently with the rest. Under that load the default 1000ms async-query
// timeout is too tight and causes spurious findBy/waitFor timeouts. Raise it so
// query timeouts reflect genuine failures, not scheduler starvation.
configure({ asyncUtilTimeout: 10000 })
