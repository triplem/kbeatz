import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ColorSchemeProvider } from './color-scheme-context'
import { ThemeToggle } from './theme-toggle'
import { COLOR_SCHEME_ATTR, THEME_STORAGE_KEY } from './theme'

function stubMatchMedia(prefersDark: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: prefersDark,
      media: '',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  )
}

function renderToggle() {
  return render(
    <ColorSchemeProvider>
      <ThemeToggle />
    </ColorSchemeProvider>,
  )
}

describe('ThemeToggle', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.removeAttribute(COLOR_SCHEME_ATTR)
    stubMatchMedia(false) // OS = light
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should render an accessible button labelled with the action (not a placeholder)', () => {
    renderToggle()
    // In light mode the action is to switch to dark.
    expect(
      screen.getByRole('button', { name: 'Switch to dark theme' }),
    ).toBeInTheDocument()
  })

  it('should toggle the scheme and persist on click', async () => {
    const user = userEvent.setup()
    renderToggle()

    await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }))

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(document.documentElement.getAttribute(COLOR_SCHEME_ATTR)).toBe('dark')
    // Label now reflects the next action.
    expect(
      screen.getByRole('button', { name: 'Switch to light theme' }),
    ).toBeInTheDocument()
  })
})
