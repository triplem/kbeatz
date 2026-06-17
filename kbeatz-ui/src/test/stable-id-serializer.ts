import { expect } from 'vitest'
import type { Config, NewPlugin, Printer, Refs } from '@vitest/pretty-format'

/**
 * Snapshot serializer that normalises React `useId()` output so serialized-DOM
 * snapshots stay byte-stable regardless of how many components rendered before
 * them in the same worker process.
 *
 * React's `useId` produces values whose numeric/hex suffix is a running counter
 * scoped to the worker, not the test (e.g. `_r_4_`, `_r_19_`, or the legacy
 * `:r0:` form). That counter depends on test execution order, so an otherwise
 * identical DOM serialises differently between runs and across the visual
 * suites. These ids are never assertable content (they only wire hidden MUI
 * native inputs to their labels), so collapsing them to a single stable token
 * removes the only source of snapshot non-determinism without losing signal.
 *
 * Implementation: this serializer matches DOM elements that carry a useId
 * somewhere in their subtree, clones the subtree, rewrites the offending
 * attribute values to a stable token, then hands the cleaned clone back to
 * Vitest's normal pretty-format DOM serializer via the `printer` callback. That
 * keeps the readable, indented HTML output while guaranteeing determinism.
 */

// Matches both modern (`_r_1a_`) and legacy (`:r1a:`) React useId formats.
const REACT_ID_RE = /(?:_r_[0-9a-z]+_|:r[0-9a-z]+:)/g
const STABLE_ID = '<reactid>'

/** Replace every React useId occurrence in a string with a stable token. */
export function normaliseReactIds(value: string): string {
  return value.replace(REACT_ID_RE, STABLE_ID)
}

const NORMALISED = Symbol('stable-id-normalised')

interface MarkedElement extends Element {
  [NORMALISED]?: true
}

function hasReactId(el: Element): boolean {
  for (const attr of Array.from(el.attributes)) {
    REACT_ID_RE.lastIndex = 0
    if (REACT_ID_RE.test(attr.value)) {
      return true
    }
  }
  for (const child of Array.from(el.children)) {
    if (hasReactId(child)) {
      return true
    }
  }
  return false
}

function rewriteIds(el: Element): void {
  for (const attr of Array.from(el.attributes)) {
    REACT_ID_RE.lastIndex = 0
    if (REACT_ID_RE.test(attr.value)) {
      el.setAttribute(attr.name, normaliseReactIds(attr.value))
    }
  }
  for (const child of Array.from(el.children)) {
    rewriteIds(child)
  }
}

const stableIdSerializer: NewPlugin = {
  test(value: unknown): boolean {
    return (
      value instanceof Element &&
      (value as MarkedElement)[NORMALISED] !== true &&
      hasReactId(value)
    )
  },
  serialize(
    value: MarkedElement,
    config: Config,
    indentation: string,
    depth: number,
    refs: Refs,
    printer: Printer,
  ): string {
    const clone = value.cloneNode(true) as MarkedElement
    rewriteIds(clone)
    // Mark the clone so this serializer does not match it again (it no longer
    // contains a useId, but the guard makes the intent explicit) and the
    // built-in DOM serializer takes over to render readable, indented HTML.
    clone[NORMALISED] = true
    return printer(clone, config, indentation, depth, refs)
  },
}

/** Register the serializer with Vitest's snapshot machinery (call once, in setup). */
export function installStableIdSerializer(): void {
  expect.addSnapshotSerializer(stableIdSerializer)
}
