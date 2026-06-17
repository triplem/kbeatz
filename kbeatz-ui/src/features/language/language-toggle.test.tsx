import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import i18n from '../../lib/i18n'
import { LanguageToggle } from './language-toggle'

const LANG_STORAGE_KEY = 'i18nextLng'

async function resetLanguage(): Promise<void> {
  window.localStorage.clear()
  await i18n.changeLanguage('en')
}

describe('LanguageToggle', () => {
  beforeEach(async () => {
    await resetLanguage()
  })
  afterEach(async () => {
    await resetLanguage()
  })

  it('should render a labelled group with both languages as toggle buttons', () => {
    render(<LanguageToggle />)

    expect(screen.getByRole('group', { name: 'Select language' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Deutsch' })).toBeInTheDocument()
  })

  it('should mark the active language as pressed', () => {
    render(<LanguageToggle />)

    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Deutsch' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('should switch the language and persist it on click', async () => {
    const user = userEvent.setup()
    render(<LanguageToggle />)

    await user.click(screen.getByRole('button', { name: 'Deutsch' }))

    expect(i18n.language).toBe('de')
    expect(window.localStorage.getItem(LANG_STORAGE_KEY)).toBe('de')
    expect(screen.getByRole('button', { name: 'Deutsch' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('should keep the active language selected when its own button is re-clicked', async () => {
    const user = userEvent.setup()
    render(<LanguageToggle />)

    await user.click(screen.getByRole('button', { name: 'English' }))

    expect(i18n.language).toBe('en')
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('should be operable by keyboard', async () => {
    const user = userEvent.setup()
    render(<LanguageToggle />)

    const german = screen.getByRole('button', { name: 'Deutsch' })
    german.focus()
    await user.keyboard('{Enter}')

    expect(i18n.language).toBe('de')
  })

  it('should fall back to English when the active language is unsupported', async () => {
    await i18n.changeLanguage('fr')
    render(<LanguageToggle />)

    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true')
  })
})
