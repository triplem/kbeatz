import { afterEach } from 'vitest'
import { theme } from '../theme/theme'

/**
 * Responsive-matrix test helper.
 *
 * jsdom performs no layout or CSS cascade, so a component's responsive
 * behaviour cannot be observed by inspecting computed geometry. The only
 * runtime signal a component reads about the viewport is `window.matchMedia`,
 * which MUI's `useMediaQuery` and (indirectly) the responsive `sx`/`display`
 * system are built on. This helper installs a deterministic `matchMedia`
 * implementation that evaluates the standard `(min-width:..)` /
 * `(max-width:..)` media-query strings MUI emits against a fixed viewport
 * width, so any breakpoint can be simulated reproducibly in a unit test
 * without a real browser.
 *
 * Usage:
 *
 * ```ts
 * setViewport('xs')           // simulate a phone-width viewport
 * render(<AppShell />)
 * // useMediaQuery(theme.breakpoints.up('md')) now resolves to false
 * ```
 *
 * Call `resetViewport()` in teardown (or rely on the auto-reset installed by
 * `installViewportAutoReset()`).
 */

/** The five MUI breakpoint keys, smallest to largest. */
export const BREAKPOINTS = ['xs', 'sm', 'md', 'lg', 'xl'] as const

export type Breakpoint = (typeof BREAKPOINTS)[number]

/**
 * A representative pixel width for each breakpoint. Each value sits comfortably
 * inside its band (well clear of the boundary) so floating-point boundary math
 * in the `max-width:...95px` queries can never flip a result. Driven from the
 * theme's own breakpoint values so it stays correct if the theme changes.
 */
export const VIEWPORT_WIDTHS: Record<Breakpoint, number> = {
  xs: theme.breakpoints.values.xs + 320, // 320 - phone portrait
  sm: theme.breakpoints.values.sm + 168, // 768 - tablet portrait
  md: theme.breakpoints.values.md + 124, // 1024 - small laptop
  lg: theme.breakpoints.values.lg + 240, // 1440 - desktop
  xl: theme.breakpoints.values.xl + 384, // 1920 - large desktop
}

const MIN_WIDTH_RE = /\(min-width:\s*([\d.]+)px\)/
const MAX_WIDTH_RE = /\(max-width:\s*([\d.]+)px\)/

/**
 * Evaluate a CSS media-query string against a viewport width. Only the
 * width-range features MUI emits (`min-width`, `max-width`, combined with
 * `and`, plus the `prefers-color-scheme` feature used by the theme) are
 * relevant; any query without a width constraint is treated as matching so
 * unrelated `matchMedia` consumers (e.g. OS colour-scheme detection) keep
 * working off their own stub.
 */
function evaluateQuery(query: string, width: number): boolean {
  const min = MIN_WIDTH_RE.exec(query)
  const max = MAX_WIDTH_RE.exec(query)
  if (!min && !max) {
    return false
  }
  const aboveMin = min ? width >= Number(min[1]) : true
  const belowMax = max ? width <= Number(max[1]) : true
  return aboveMin && belowMax
}

interface MediaQueryListLike extends MediaQueryList {
  matches: boolean
}

let activeWidth: number | null = null

/**
 * Install a `matchMedia` mock that resolves width-range queries against
 * `width`. The returned objects carry no-op listener registration (jsdom does
 * not fire `change` events without layout), which is sufficient for
 * `useMediaQuery`'s subscribe/getSnapshot flow because the value is read
 * synchronously on mount.
 */
function installMatchMedia(width: number): void {
  activeWidth = width
  const factory = (query: string): MediaQueryListLike => ({
    matches: evaluateQuery(query, width),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })
  // Assigned directly (not via vi.stubGlobal) so a test's own
  // vi.unstubAllGlobals() does not silently tear this down mid-test.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: factory,
  })
}

/** Simulate the viewport at the given breakpoint's representative width. */
export function setViewport(breakpoint: Breakpoint): void {
  installMatchMedia(VIEWPORT_WIDTHS[breakpoint])
}

/** Simulate the viewport at an exact pixel width (for boundary tests). */
export function setViewportWidth(width: number): void {
  installMatchMedia(width)
}

/** Remove the viewport mock so later tests get the default jsdom matchMedia. */
export function resetViewport(): void {
  activeWidth = null
  Reflect.deleteProperty(window, 'matchMedia')
}

/** The pixel width currently simulated, or null when no viewport is active. */
export function currentViewportWidth(): number | null {
  return activeWidth
}

/**
 * Register an `afterEach` hook that resets the viewport mock between tests.
 * Call once at the top of a suite that uses `setViewport`.
 */
export function installViewportAutoReset(): void {
  afterEach(() => {
    resetViewport()
  })
}

/**
 * Whether a MUI `theme.breakpoints.{up,down,only}` query matches at a given
 * breakpoint. Lets responsive expectations be asserted directly against the
 * same query strings the components consume, instead of duplicating pixel math
 * in the test.
 */
export function queryMatchesAt(query: string, breakpoint: Breakpoint): boolean {
  return evaluateQuery(query, VIEWPORT_WIDTHS[breakpoint])
}
