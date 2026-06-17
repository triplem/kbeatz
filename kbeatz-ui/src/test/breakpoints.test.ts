import { describe, it, expect } from 'vitest'
import { theme } from '../theme/theme'
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

describe('breakpoint helper', () => {
  it('exposes all five MUI breakpoints in ascending width order', () => {
    expect(BREAKPOINTS).toEqual(['xs', 'sm', 'md', 'lg', 'xl'])
    const widths = BREAKPOINTS.map((bp) => VIEWPORT_WIDTHS[bp])
    const sorted = [...widths].sort((a, b) => a - b)
    expect(widths).toEqual(sorted)
  })

  it('setViewport installs a matchMedia that resolves min-width up-queries', () => {
    setViewport('xs')
    expect(window.matchMedia(theme.breakpoints.up('md')).matches).toBe(false)
    setViewport('lg')
    expect(window.matchMedia(theme.breakpoints.up('md')).matches).toBe(true)
  })

  it('resolves down-queries (max-width) correctly', () => {
    setViewport('sm')
    expect(window.matchMedia(theme.breakpoints.down('md')).matches).toBe(true)
    setViewport('xl')
    expect(window.matchMedia(theme.breakpoints.down('md')).matches).toBe(false)
  })

  it('resolves only-queries (banded min+max) correctly', () => {
    setViewport('sm')
    expect(window.matchMedia(theme.breakpoints.only('sm')).matches).toBe(true)
    setViewport('md')
    expect(window.matchMedia(theme.breakpoints.only('sm')).matches).toBe(false)
  })

  it('does not match a query without a width feature', () => {
    setViewport('md')
    expect(window.matchMedia('(prefers-color-scheme: dark)').matches).toBe(false)
  })

  it('queryMatchesAt mirrors matchMedia for each breakpoint', () => {
    const up = theme.breakpoints.up('md')
    expect(queryMatchesAt(up, 'xs')).toBe(false)
    expect(queryMatchesAt(up, 'sm')).toBe(false)
    expect(queryMatchesAt(up, 'md')).toBe(true)
    expect(queryMatchesAt(up, 'lg')).toBe(true)
    expect(queryMatchesAt(up, 'xl')).toBe(true)
  })

  it('setViewportWidth supports exact-width boundary checks', () => {
    setViewportWidth(900)
    expect(window.matchMedia(theme.breakpoints.up('md')).matches).toBe(true)
    setViewportWidth(899)
    expect(window.matchMedia(theme.breakpoints.up('md')).matches).toBe(false)
  })

  it('tracks and resets the active width', () => {
    setViewport('lg')
    expect(currentViewportWidth()).toBe(VIEWPORT_WIDTHS.lg)
    resetViewport()
    expect(currentViewportWidth()).toBeNull()
  })
})
