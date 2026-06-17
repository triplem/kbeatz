import { render, screen } from '@testing-library/react'
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
  it('renders nothing when all option lists are empty', () => {
    const emptyOptions: FilterOptions = { genres: [], artists: [], composers: [] }
    const { container } = render(
      <FilterPanel options={emptyOptions} filters={EMPTY_FILTERS} onFiltersChange={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

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

  it('renders composer filter checkboxes', () => {
    render(<FilterPanel options={OPTIONS} filters={EMPTY_FILTERS} onFiltersChange={vi.fn()} />)
    expect(
      screen.getByRole('checkbox', { name: 'Johann Sebastian Bach' }),
    ).toBeInTheDocument()
  })

  it('does not render empty genres section when options.genres is empty but others have content', () => {
    const partialOptions: FilterOptions = { genres: [], artists: ['Miles Davis'], composers: [] }
    render(<FilterPanel options={partialOptions} filters={EMPTY_FILTERS} onFiltersChange={vi.fn()} />)
    expect(screen.queryByRole('group', { name: 'Genre filter' })).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Miles Davis' })).toBeInTheDocument()
  })

  it('does not render any year range or year input element', () => {
    render(<FilterPanel options={OPTIONS} filters={EMPTY_FILTERS} onFiltersChange={vi.fn()} />)
    // No year range container (remnant from removed year range filter)
    expect(document.querySelector('[class*="yearRange"]')).toBeNull()
    // No year number inputs
    expect(document.querySelector('[class*="yearInput"]')).toBeNull()
    // No spinbox role (year number inputs use role=spinbutton)
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    // No inputs of type number inside the filter panel
    expect(document.querySelector('aside input[type="number"]')).toBeNull()
  })

  // The informational multi-value notice is a non-urgent polite status region
  // (role="status"), not an assertive alert (WCAG 4.1.3 - severity="info").
  it('shows multi-value warning when 2 genres are selected', () => {
    const filters: AlbumFilters = { ...EMPTY_FILTERS, genres: ['Jazz', 'Classical'] }
    render(<FilterPanel options={OPTIONS} filters={filters} onFiltersChange={vi.fn()} />)
    const notice = screen.getByRole('status')
    expect(notice).toBeInTheDocument()
    expect(notice.textContent).toContain('current page')
  })

  it('does not show warning when only 1 genre is selected', () => {
    const filters: AlbumFilters = { ...EMPTY_FILTERS, genres: ['Jazz'] }
    render(<FilterPanel options={OPTIONS} filters={filters} onFiltersChange={vi.fn()} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('does not show warning when no filters are active', () => {
    render(<FilterPanel options={OPTIONS} filters={EMPTY_FILTERS} onFiltersChange={vi.fn()} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows warning when 2 artists are selected', () => {
    const filters: AlbumFilters = { ...EMPTY_FILTERS, artists: ['Miles Davis', 'John Coltrane'] }
    render(<FilterPanel options={OPTIONS} filters={filters} onFiltersChange={vi.fn()} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
