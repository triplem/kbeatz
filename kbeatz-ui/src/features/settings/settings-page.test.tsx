import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type ReactNode } from 'react'
import { AppThemeProvider } from '../../theme'
import { SettingsPage } from './settings-page'
import { loadSortPreference } from '../albums/album-filters'

function stubMatchMedia(): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: false,
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

function wrapper({ children }: { children: ReactNode }) {
  return <AppThemeProvider>{children}</AppThemeProvider>
}

describe('SettingsPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    stubMatchMedia()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('consolidates the sort, language and theme controls (AC5)', () => {
    render(<SettingsPage />, { wrapper })
    expect(screen.getByTestId('settings-page')).toBeInTheDocument()
    // Sort preference (reused component) - combobox.
    expect(screen.getByRole('combobox', { name: 'Sort by' })).toBeInTheDocument()
    // Language control (reused component) - radiogroup of buttons.
    expect(screen.getByRole('group', { name: 'Select language' })).toBeInTheDocument()
    // Theme toggle (reused #827 component).
    expect(screen.getByRole('button', { name: /switch to (light|dark) theme/i })).toBeInTheDocument()
  })

  it('persists the sort preference selection to localStorage', async () => {
    const user = userEvent.setup()
    render(<SettingsPage />, { wrapper })
    // MUI Select: open the listbox, then choose the option.
    await user.click(screen.getByRole('combobox', { name: 'Sort by' }))
    await user.click(screen.getByRole('option', { name: 'Composer' }))
    expect(loadSortPreference()).toBe('composer')
  })

  it('renders a labelled heading for the page', () => {
    render(<SettingsPage />, { wrapper })
    expect(screen.getByRole('heading', { name: 'Settings', level: 1 })).toBeInTheDocument()
  })
})
