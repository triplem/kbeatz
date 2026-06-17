# kbeatz-ui Test Strategy and Feature-Parity Baseline

This document is the parity baseline for the UI rework (epic #825). It
enumerates the test suites that together verify "feature parity / no
regression" and explains how the four layers (visual regression, responsive
matrix, behaviour, and accessibility) fit together. It was added by story #833.

All suites run under Vitest + Testing Library in jsdom. There is no browser
infrastructure: visual regression uses serialized-DOM snapshots, not
screenshots, so the suite stays deterministic and CI-light. Everything below
runs as part of `npm run test` and `npm run test:coverage`, so it executes in
the existing frontend CI job with no extra wiring.

## Test pyramid for the UI

```
        Accessibility (axe)   *.a11y.test.tsx   - WCAG 2.1 A/AA, both themes
       Visual regression      *.visual.test.*   - serialized DOM, both themes
      Responsive matrix       *.responsive.*    - xs/sm/md/lg/xl
     Behaviour / flow         feature + shell tests
    Unit                      hooks, helpers, pure functions
```

## 1. Visual regression (`src/**/*.visual.test.{ts,tsx}`)

DOM snapshots (`toMatchSnapshot`) of each main screen rendered under BOTH the
light and dark colour schemes. Snapshots are byte-stable because:

- data comes from fixed fixtures (`src/test/fixtures.ts`) - no clock, no random
  ids;
- React `useId()` values are normalised to `<reactid>` by the snapshot
  serializer in `src/test/stable-id-serializer.ts` (registered in
  `src/test-setup.ts`), so execution order can never flip a snapshot.

Screens x themes covered:

| Screen | Suite | States | Themes |
|---|---|---|---|
| Album list / grid | `src/visual/album-list.visual.test.tsx` | populated, loading, error, empty | light + dark |
| Album detail + editing | `src/visual/album-detail.visual.test.tsx` | loaded | light + dark |
| Library | `src/visual/library.visual.test.tsx` | default | light + dark |
| Settings | `src/visual/settings.visual.test.tsx` | default | light + dark |
| Sync panel | `src/visual/sync-panel.visual.test.tsx` | idle | light + dark |
| App shell | `src/visual/app-shell.visual.test.tsx` | md viewport | light + dark |

Because the app themes via MUI CSS variables selected by a root attribute, the
rendered DOM markup is identical in both schemes; the colour difference lives in
the stylesheet. The per-screen DOM snapshots therefore prove each screen renders
cleanly in each theme, and `src/visual/theme-tokens.visual.test.ts` pins the
actual resolved palette tokens for light and dark so a colour regression in
either scheme is caught - that is the other half of "both themes" coverage.

Updating snapshots after an intentional change: `npx vitest run -u src/visual`.
Review the diff in the PR like any other code change.

## 2. Responsive matrix (`src/**/*.responsive.test.tsx`)

Asserts the layout contract across all five MUI breakpoints (xs, sm, md, lg,
xl). jsdom performs no layout, so the viewport is driven through `matchMedia`
(the basis of `useMediaQuery` and MUI's responsive `display` system) by the
helper `src/test/breakpoints.ts` (`setViewport`, `queryMatchesAt`,
`installViewportAutoReset`).

| Concern | Suite | Assertion |
|---|---|---|
| Nav drawer overlay (xs/sm) vs permanent (md+) | `src/shell/app-shell.responsive.test.tsx` | drawer mode decision at each breakpoint; boundary is exactly md (900px); nav reachable everywhere |
| Album grid column reflow | `src/features/albums/album-list.responsive.test.tsx` | fluid `auto-fill` grid template at every breakpoint; renders without error across the matrix |

The breakpoint helper itself is unit-tested in `src/test/breakpoints.test.ts`.

## 3. Behaviour / cross-cutting flows

These flows were implemented and tested by earlier stories; the single living
index of where each is verified is `src/behaviour-coverage.index.test.ts`
(which also asserts the owning suites still exist). Summary:

| Flow | Owning suite(s) |
|---|---|
| Theme persistence + OS default + corrupt-value fallback | `src/theme/color-scheme-context.test.tsx`, `src/theme/theme-storage.test.ts`, `src/shell/app-shell-localstorage-fallback.test.tsx` |
| Routing + unsaved-changes guard on route change AND back/forward | `src/shell/use-unsaved-changes-blocker.test.tsx`, `src/features/albums/album-detail.test.tsx` (navigation-guard describe, incl. the `act()` effect-flush after clearing dirty), `src/shell/app-shell.test.tsx` |
| Grid pagination (page change, filter -> page 1, URL round-trip, back-restore) | `src/App.test.tsx`, `src/features/albums/usePagination.test.tsx`, `src/features/albums/useScrollRestoration.test.tsx` |

Router-navigation-after-clearing-dirty tests flush effects with
`await act(async () => { await Promise.resolve() })` so react-router's
`useBlocker` re-registers before the navigation is attempted.

## 4. Accessibility (`src/**/*.a11y.test.tsx`)

axe (`vitest-axe`) audits each screen against WCAG 2.1 Level A/AA in both
colour schemes via the helpers in `src/test/a11y.ts`
(`expectNoA11yViolationsInBothThemes`, `assertNoA11yViolations`). Colour
contrast is verified computationally in `src/theme/contrast.test.ts` because
jsdom cannot resolve painted colours. Suites: `App.a11y`, `album-card.a11y`,
`album-detail.a11y`, `dialogs.a11y`, `library-page.a11y`, `scan-banners.a11y`,
`settings-page.a11y`, `sync-panel.a11y`, `app-shell.a11y`.

## How the layers fit together

- Behaviour tests prove the app DOES the right thing (state, navigation,
  persistence).
- Visual-regression snapshots prove the app LOOKS structurally unchanged in both
  themes (catches accidental markup drift).
- The responsive matrix proves the layout adapts correctly across breakpoints.
- Accessibility audits prove the result is usable by assistive technology.

A change that breaks parity will fail at least one layer: a behaviour bug fails a
flow test, a markup change fails a snapshot, a breakpoint regression fails the
matrix, and an a11y regression fails axe.

## Test-infrastructure stability (do not weaken)

`vite.config.ts` caps the Vitest worker pool (`maxThreads: 4`) and sets
`testTimeout: 20000`; `src/test-setup.ts` sets `asyncUtilTimeout: 10000`. These
keep the CPU-heavy axe suites from starving timer-driven tests on many-core CI
machines. The visual and responsive suites are dev-only test code and have no
production bundle impact (verified by `npm run size-limit`).

## CI

The frontend CI job runs `npm run test` / `npm run test:coverage`, which
discovers every `*.test.{ts,tsx}` (including `*.visual.test.*` and
`*.responsive.test.*`) automatically. No separate visual-regression script is
needed, so there is nothing extra to wire; the worker-pool cap is preserved.

## Known limitations (jsdom test depth)

These suites run under jsdom, which parses and builds the DOM but performs **no
layout and no paint**. That bounds what the "visual" and "responsive" layers can
actually verify - be aware of the gap rather than over-trusting a green run:

- **Visual-regression is DOM-structural, not pixel-visual.** The snapshots assert
  the rendered markup is unchanged; they do **not** catch real visual regressions
  (colour, spacing, overflow, font, contrast) because nothing is painted. Because
  the MUI theme is applied via CSS custom properties on `<html>`, the light and
  dark DOM is in fact identical - so `theme-tokens.visual.test.ts` separately pins
  the resolved palette values to catch a colour-token regression. A broken layout
  that still produces the same markup would pass.
- **Responsive checks assert structure, not geometry.** The matrix drives
  `matchMedia` and asserts breakpoint-driven branches (e.g. drawer overlay at
  xs/sm vs permanent at md+). It cannot assert "no horizontal scroll" or true
  column reflow, because jsdom computes no box geometry.
- **Contrast is verified computationally, not as rendered.** axe's `color-contrast`
  rule is disabled under jsdom (it cannot resolve computed colours); brand-palette
  contrast is instead checked against the WCAG thresholds in
  `src/theme/contrast.test.ts`. Real rendered contrast of composed UI is not
  automatically verified.

**What still requires a human (or future tooling):** actual visual appearance,
layout/overflow at real viewport sizes, and rendered contrast are verified by
manual review. True pixel-level visual regression would require a real browser
(e.g. Playwright component/page screenshots in CI); that is intentionally out of
scope here (heavier, browser-dependent, flakier) and is tracked as possible
future work. Treat the four automated layers as catching *structural* and
*behavioural* regressions, with rendered visuals covered manually.
