// Augments Vitest's `expect` with the vitest-axe accessibility matcher.
// vitest-axe's own `extend-expect` declaration targets the legacy `Vi`
// namespace; this maps the same matchers onto Vitest 4's `expect` interface.
import 'vitest'
import type { AxeMatchers } from 'vitest-axe/matchers'

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Assertion extends AxeMatchers {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
