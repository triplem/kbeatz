import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { AppThemeProvider } from '../../theme'
import { PageSizeSelect } from './page-size-select'

function renderSelect(value: 25 | 50 | 100 | 250, onChange = vi.fn()) {
  render(
    <AppThemeProvider>
      <PageSizeSelect value={value} onChange={onChange} />
    </AppThemeProvider>,
  )
  return { onChange }
}

describe('PageSizeSelect', () => {
  it('renders a labelled combobox showing the current size', () => {
    renderSelect(50)
    const select = screen.getByRole('combobox', { name: 'Per page' })
    expect(select).toHaveTextContent('50 per page')
  })

  it('calls onChange with the chosen size', async () => {
    const user = userEvent.setup()
    const { onChange } = renderSelect(50)
    await user.click(screen.getByRole('combobox', { name: 'Per page' }))
    await user.click(screen.getByRole('option', { name: '100 per page' }))
    expect(onChange).toHaveBeenCalledWith(100)
  })

  it('offers all configured size options', async () => {
    const user = userEvent.setup()
    renderSelect(50)
    await user.click(screen.getByRole('combobox', { name: 'Per page' }))
    for (const size of [25, 50, 100, 250]) {
      expect(screen.getByRole('option', { name: `${size} per page` })).toBeInTheDocument()
    }
  })
})
