import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { AppThemeProvider } from '../../theme'
import { SortPreference } from './sort-preference'
import type { SortDirection, SortField } from './album-filters'

interface SortProps {
  value: SortField
  onChange: (s: SortField) => void
  direction: SortDirection
  onDirectionChange: (d: SortDirection) => void
}

const defaultProps: SortProps = {
  value: 'albumArtist',
  onChange: vi.fn(),
  direction: 'asc',
  onDirectionChange: vi.fn(),
}

function renderSort(props: SortProps = defaultProps) {
  return render(
    <AppThemeProvider>
      <SortPreference {...props} />
    </AppThemeProvider>,
  )
}

describe('SortPreference', () => {
  it('renders with albumArtist selected by default', () => {
    renderSort()
    expect(screen.getByRole('combobox', { name: 'Sort by' })).toHaveTextContent('Album Artist')
  })

  it('calls onChange with composer when Composer option is selected', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderSort({ ...defaultProps, onChange })

    await user.click(screen.getByRole('combobox', { name: 'Sort by' }))
    await user.click(screen.getByRole('option', { name: 'Composer' }))

    expect(onChange).toHaveBeenCalledWith('composer')
  })

  it('calls onChange with albumArtist when Album Artist option is selected', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderSort({ ...defaultProps, value: 'composer', onChange })

    await user.click(screen.getByRole('combobox', { name: 'Sort by' }))
    await user.click(screen.getByRole('option', { name: 'Album Artist' }))

    expect(onChange).toHaveBeenCalledWith('albumArtist')
  })

  it('renders the direction toggle labelled "Sort ascending" when asc', () => {
    renderSort({ ...defaultProps, direction: 'asc' })
    expect(screen.getByRole('button', { name: 'Sort ascending' })).toBeInTheDocument()
  })

  it('renders the direction toggle labelled "Sort descending" when desc', () => {
    renderSort({ ...defaultProps, direction: 'desc' })
    expect(screen.getByRole('button', { name: 'Sort descending' })).toBeInTheDocument()
  })

  it('calls onDirectionChange with desc when toggle clicked while asc', async () => {
    const user = userEvent.setup()
    const onDirectionChange = vi.fn()
    renderSort({ ...defaultProps, direction: 'asc', onDirectionChange })

    await user.click(screen.getByRole('button', { name: 'Sort ascending' }))

    expect(onDirectionChange).toHaveBeenCalledWith('desc')
  })

  it('calls onDirectionChange with asc when toggle clicked while desc', async () => {
    const user = userEvent.setup()
    const onDirectionChange = vi.fn()
    renderSort({ ...defaultProps, direction: 'desc', onDirectionChange })

    await user.click(screen.getByRole('button', { name: 'Sort descending' }))

    expect(onDirectionChange).toHaveBeenCalledWith('asc')
  })
})
