import { describe, it, expect } from 'vitest'
import {
  BREAKPOINTS,
  VIEWPORT_WIDTHS,
  queryMatchesAt,
  setViewport,
  setViewportWidth,
  resetViewport,
  currentViewportWidth,
  installViewportAutoReset,
} from './breakpoints'

installViewportAutoReset()

// Representative width-range media queries in the same syntax responsive code
// emits. `up('md')` -> min-width; `down('md')` -> max-width; `only('sm')` ->
// banded min+max. The helper only cares about the width features, so these
// literal strings stand in for whatever query a component consumes.
const UP_MD = '(min-width:900px)'
const DOWN_MD = '(max-width:899.95px)'
const ONLY_SM = '(min-width:600px) and (max-width:899.95px)'

describe('breakpoint helper', () => {
  it('exposes all five breakpoints in ascending width order', () => {
    expect(BREAKPOINTS).toEqual(['xs', 'sm', 'md', 'lg', 'xl'])
    const widths = BREAKPOINTS.map((bp) => VIEWPORT_WIDTHS[bp])
    const sorted = [...widths].sort((a, b) => a - b)
    expect(widths).toEqual(sorted)
  })

  it('setViewport installs a matchMedia that resolves min-width up-queries', () => {
    setViewport('xs')
    expect(window.matchMedia(UP_MD).matches).toBe(false)
    setViewport('lg')
    expect(window.matchMedia(UP_MD).matches).toBe(true)
  })

  it('resolves down-queries (max-width) correctly', () => {
    setViewport('sm')
    expect(window.matchMedia(DOWN_MD).matches).toBe(true)
    setViewport('xl')
    expect(window.matchMedia(DOWN_MD).matches).toBe(false)
  })

  it('resolves only-queries (banded min+max) correctly', () => {
    setViewport('sm')
    expect(window.matchMedia(ONLY_SM).matches).toBe(true)
    setViewport('md')
    expect(window.matchMedia(ONLY_SM).matches).toBe(false)
  })

  it('does not match a query without a width feature', () => {
    setViewport('md')
    expect(window.matchMedia('(prefers-color-scheme: dark)').matches).toBe(false)
  })

  it('queryMatchesAt mirrors matchMedia for each breakpoint', () => {
    expect(queryMatchesAt(UP_MD, 'xs')).toBe(false)
    expect(queryMatchesAt(UP_MD, 'sm')).toBe(false)
    expect(queryMatchesAt(UP_MD, 'md')).toBe(true)
    expect(queryMatchesAt(UP_MD, 'lg')).toBe(true)
    expect(queryMatchesAt(UP_MD, 'xl')).toBe(true)
  })

  it('setViewportWidth supports exact-width boundary checks', () => {
    setViewportWidth(900)
    expect(window.matchMedia(UP_MD).matches).toBe(true)
    setViewportWidth(899)
    expect(window.matchMedia(UP_MD).matches).toBe(false)
  })

  it('tracks and resets the active width', () => {
    setViewport('lg')
    expect(currentViewportWidth()).toBe(VIEWPORT_WIDTHS.lg)
    resetViewport()
    expect(currentViewportWidth()).toBeNull()
  })
})
