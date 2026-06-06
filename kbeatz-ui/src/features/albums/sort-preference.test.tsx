import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { SortPreference } from './sort-preference'

describe('SortPreference', () => {
  it('renders with albumArtist selected by default', () => {
    render(<SortPreference value="albumArtist" onChange={vi.fn()} />)
    const select = screen.getByRole('combobox', { name: 'Sort albums by' })
    expect(select).toHaveValue('albumArtist')
  })

  it('calls onChange with composer when Composer option is selected', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SortPreference value="albumArtist" onChange={onChange} />)

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Sort albums by' }),
      'Composer',
    )

    expect(onChange).toHaveBeenCalledWith('composer')
  })

  it('calls onChange with albumArtist when Album Artist option is selected', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SortPreference value="composer" onChange={onChange} />)

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Sort albums by' }),
      'Album Artist',
    )

    expect(onChange).toHaveBeenCalledWith('albumArtist')
  })

  it('renders both sort options', () => {
    render(<SortPreference value="albumArtist" onChange={vi.fn()} />)
    expect(screen.getByRole('option', { name: 'Album Artist' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Composer' })).toBeInTheDocument()
  })
})
