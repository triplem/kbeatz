import { describe, expect, it } from 'vitest'
// Vite's ?raw import loads the file as a string without needing Node globals.
import html from '../../index.html?raw'
import { THEME_STORAGE_KEY } from './theme'

/**
 * Guards the no-flash bootstrap script + CSP invariants in index.html (AC5).
 * These cannot regress silently: the script must validate only light|dark and
 * fall back to the OS, and the CSP must use a hash placeholder (not
 * 'unsafe-inline') for scripts. The build plugin replaces the placeholder with
 * the real SHA-256 hash of the final inline script.
 */
describe('index.html no-flash bootstrap + CSP', () => {
  it('should contain exactly one inline bootstrap script', () => {
    const matches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    expect(matches).toHaveLength(1)
  })

  it('should read the same localStorage key the app uses', () => {
    expect(html).toContain(`getItem('${THEME_STORAGE_KEY}')`)
  })

  it('should validate only light|dark and otherwise follow prefers-color-scheme', () => {
    const body = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? ''
    expect(body).toContain("=== 'light'")
    expect(body).toContain("=== 'dark'")
    expect(body).toContain('prefers-color-scheme: dark')
    expect(body).toContain("setAttribute('data-mui-color-scheme'")
  })

  it('should declare a hash-based script-src CSP without unsafe-inline for scripts', () => {
    expect(html).toContain('http-equiv="Content-Security-Policy"')
    const csp = /content="(default-src[^"]*)"/.exec(html)?.[1] ?? ''
    const directives = csp.split(';').map((d) => d.trim())
    const scriptSrc = directives.find((d) => d.startsWith('script-src')) ?? ''
    expect(scriptSrc).not.toContain('unsafe-inline')
    // A placeholder (replaced at build time) or a literal sha256 hash is present.
    expect(scriptSrc).toMatch(/__INLINE_THEME_SCRIPT_HASH__|sha256-/)
  })
})
