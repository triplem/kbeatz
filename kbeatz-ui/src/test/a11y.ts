import { type ReactElement } from 'react'
import { cleanup, render, type RenderOptions } from '@testing-library/react'
import { act } from 'react'
import { expect } from 'vitest'
import { axe } from 'vitest-axe'
import * as axeMatchers from 'vitest-axe/matchers'
import { applyTheme } from './render-helpers'

// vitest-axe ships an empty `extend-expect` build artifact, so the matcher is
// registered explicitly here. Importing this module is enough to make
// `expect(results).toHaveNoViolations()` available in any spec.
expect.extend(axeMatchers)

/**
 * Audit configuration.
 *
 * - `runOnly` restricts axe to the WCAG 2.0/2.1 Level A and AA success-criteria
 *   rule sets. This is exactly the story's conformance target and excludes
 *   axe "best-practice" rules (e.g. `region`, `landmark-one-main`) that are not
 *   WCAG success criteria and that fire only because a component is rendered in
 *   isolation outside the app shell's <main> landmark in unit tests.
 * - `color-contrast` is disabled because jsdom performs no layout or paint, so
 *   axe cannot resolve computed colours and always returns "incomplete" (never
 *   a hard violation). Brand-palette contrast is instead verified
 *   computationally against the WCAG thresholds in `src/theme/contrast.test.ts`.
 */
const AXE_OPTIONS = {
  runOnly: {
    type: 'tag' as const,
    values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
  },
  rules: {
    'color-contrast': { enabled: false },
  },
}

/**
 * Run axe against an already-mounted DOM scope and assert no WCAG 2.1 A/AA
 * violations. Use this when a screen loads data asynchronously and the test
 * must `await` content (and any portalled dialogs in `document.body`) before
 * auditing.
 */
export async function assertNoA11yViolations(scope: Element = document.body): Promise<void> {
  await act(async () => {
    await Promise.resolve()
  })
  const results = await axe(scope, AXE_OPTIONS)
  expect(results).toHaveNoViolations()
}

/**
 * Render `ui` and assert axe reports no WCAG 2.1 A/AA violations.
 *
 * Flushes pending effects with `act` before running axe so any focus moves,
 * live-region wiring, or async state settle first.
 */
export async function expectNoA11yViolations(
  ui: ReactElement,
  options?: RenderOptions,
): Promise<void> {
  const { container } = render(ui, options)
  await assertNoA11yViolations(container)
}

/**
 * Render `ui` once per colour scheme (light + dark) and assert axe reports no
 * violations in either theme. Satisfies the story requirement that every screen
 * is checked in BOTH themes.
 */
export async function expectNoA11yViolationsInBothThemes(
  factory: () => ReactElement,
  options?: RenderOptions,
): Promise<void> {
  for (const theme of ['light', 'dark'] as const) {
    applyTheme(theme)
    await expectNoA11yViolations(factory(), options)
    // Unmount + remove the rendered DOM before the next theme render so the two
    // passes do not accumulate duplicate landmarks (banner/main) in the same
    // jsdom document, which would itself trip axe's landmark-uniqueness rules.
    cleanup()
  }
}
