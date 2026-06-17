import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderRoute, THEMES } from '../test/render-helpers'
import { setViewport, resetViewport } from '../test/breakpoints'

// The shell mounts the global scan-progress banner; stub its data layer so the
// snapshot is inert and clock/network-free.
vi.mock('../features/library/scan-progress', () => ({
  ScanProgress: () => <div data-testid="scan-progress" />,
}))

import { AppShell } from '../shell/app-shell'

/**
 * Visual-regression snapshots for the application shell (app bar + navigation
 * drawer + content region) in both colour schemes, captured at a fixed md
 * viewport so the responsive drawer rendering is deterministic.
 */
describe('AppShell visual regression', () => {
  beforeEach(() => {
    window.localStorage.clear()
    setViewport('md')
  })
  afterEach(() => {
    resetViewport()
  })

  for (const theme of THEMES) {
    it(`matches the shell snapshot in ${theme} theme`, () => {
      const { container } = renderRoute(
        [
          {
            element: <AppShell />,
            children: [{ index: true, element: <div data-testid="route-content">Content</div> }],
          },
        ],
        { theme },
      )
      expect(container).toMatchSnapshot()
    })
  }
})
