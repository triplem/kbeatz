import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { FilterPanel } from './filter-panel'
import { EMPTY_FILTERS } from './album-filters'
import type { FilterOptions, AlbumFilters } from './album-filters'

const OPTIONS: FilterOptions = {
  genres: ['Classical', 'Jazz', 'Rock'],
  artists: ['Miles Davis', 'John Coltrane'],
  composers: ['Johann Sebastian Bach'],
}

describe('FilterPanel', () => {
  it('renders genre checkboxes from options', () => {
    render(<FilterPanel options={OPTIONS} filters={EMPTY_FILTERS} onFiltersChange={vi.fn()} />)
    expect(screen.getByRole('checkbox', { name: 'Jazz' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Classical' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Rock' })).toBeInTheDocument()
  })

  it('calls onFiltersChange with new genre when checkbox is toggled', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<FilterPanel options={OPTIONS} filters={EMPTY_FILTERS} onFiltersChange={onChange} />)

    await user.click(screen.getByRole('checkbox', { name: 'Jazz' }))

    expect(onChange).toHaveBeenCalledWith({
      ...EMPTY_FILTERS,
      genres: ['Jazz'],
    })
  })

  it('removes genre from filters when already-checked genre is toggled', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const filtersWithJazz: AlbumFilters = { ...EMPTY_FILTERS, genres: ['Jazz'] }
    render(<FilterPanel options={OPTIONS} filters={filtersWithJazz} onFiltersChange={onChange} />)

    await user.click(screen.getByRole('checkbox', { name: 'Jazz' }))

    expect(onChange).toHaveBeenCalledWith({
      ...EMPTY_FILTERS,
      genres: [],
    })
  })

  it('renders year range inputs', () => {
    render(<FilterPanel options={OPTIONS} filters={EMPTY_FILTERS} onFiltersChange={vi.fn()} />)
    expect(screen.getByRole('spinbutton', { name: 'Year from' })).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: 'Year to' })).toBeInTheDocument()
  })

  it('calls onFiltersChange with yearMin when year-from input changes', () => {
    const onChange = vi.fn()
    render(<FilterPanel options={OPTIONS} filters={EMPTY_FILTERS} onFiltersChange={onChange} />)

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Year from' }), {
      target: { value: '1970' },
    })

    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, yearMin: 1970 })
  })

  it('renders composer filter checkboxes', () => {
    render(<FilterPanel options={OPTIONS} filters={EMPTY_FILTERS} onFiltersChange={vi.fn()} />)
    expect(
      screen.getByRole('checkbox', { name: 'Johann Sebastian Bach' }),
    ).toBeInTheDocument()
  })

  it('does not render empty genres section when options.genres is empty', () => {
    const emptyOptions: FilterOptions = { genres: [], artists: [], composers: [] }
    render(<FilterPanel options={emptyOptions} filters={EMPTY_FILTERS} onFiltersChange={vi.fn()} />)
    expect(screen.queryByRole('group', { name: 'Genre filter' })).not.toBeInTheDocument()
  })
})
