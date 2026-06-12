import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { SortPreference } from './sort-preference'

const defaultProps = {
  value: 'albumArtist' as const,
  onChange: vi.fn(),
  direction: 'asc' as const,
  onDirectionChange: vi.fn(),
}

describe('SortPreference', () => {
  it('renders with albumArtist selected by default', () => {
    render(<SortPreference {...defaultProps} />)
    const select = screen.getByRole('combobox', { name: 'Sort albums by' })
    expect(select).toHaveValue('albumArtist')
  })

  it('calls onChange with composer when Composer option is selected', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SortPreference {...defaultProps} onChange={onChange} />)

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Sort albums by' }),
      'Composer',
    )

    expect(onChange).toHaveBeenCalledWith('composer')
  })

  it('calls onChange with albumArtist when Album Artist option is selected', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SortPreference {...defaultProps} value="composer" onChange={onChange} />)

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Sort albums by' }),
      'Album Artist',
    )

    expect(onChange).toHaveBeenCalledWith('albumArtist')
  })

  it('renders both sort options', () => {
    render(<SortPreference {...defaultProps} />)
    expect(screen.getByRole('option', { name: 'Album Artist' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Composer' })).toBeInTheDocument()
  })

  it('renders direction toggle button showing A-Z when direction is asc', () => {
    render(<SortPreference {...defaultProps} direction="asc" />)
    const btn = screen.getByRole('button', { name: 'Sort ascending' })
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveTextContent('A-Z')
  })

  it('renders direction toggle button showing Z-A when direction is desc', () => {
    render(<SortPreference {...defaultProps} direction="desc" />)
    const btn = screen.getByRole('button', { name: 'Sort descending' })
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveTextContent('Z-A')
  })

  it('calls onDirectionChange with desc when toggle clicked while asc', async () => {
    const user = userEvent.setup()
    const onDirectionChange = vi.fn()
    render(<SortPreference {...defaultProps} direction="asc" onDirectionChange={onDirectionChange} />)

    await user.click(screen.getByRole('button', { name: 'Sort ascending' }))

    expect(onDirectionChange).toHaveBeenCalledWith('desc')
  })

  it('calls onDirectionChange with asc when toggle clicked while desc', async () => {
    const user = userEvent.setup()
    const onDirectionChange = vi.fn()
    render(<SortPreference {...defaultProps} direction="desc" onDirectionChange={onDirectionChange} />)

    await user.click(screen.getByRole('button', { name: 'Sort descending' }))

    expect(onDirectionChange).toHaveBeenCalledWith('asc')
  })
})
