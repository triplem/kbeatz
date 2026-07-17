import { render, screen, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SearchBox } from './search-box'
import { EMPTY_FILTERS } from './album-filters'
import type { AlbumFilters } from './album-filters'

describe('SearchBox', () => {
  it('renders the search input', () => {
    render(<SearchBox filters={EMPTY_FILTERS} onFiltersChange={vi.fn()} />)
    expect(screen.getByRole('textbox', { name: 'Search' })).toBeInTheDocument()
  })

  it('renders a visible label linked to the search input', () => {
    render(<SearchBox filters={EMPTY_FILTERS} onFiltersChange={vi.fn()} />)
    // The accessible name comes from the linked <label> (no placeholder-only
    // labelling); resolving the input by that name proves the association.
    expect(screen.getByRole('textbox', { name: 'Search' })).toBeInTheDocument()
    const label = screen.getByText('Search')
    expect(label.tagName.toLowerCase()).toBe('label')
  })

  it('has descriptive placeholder text', () => {
    render(<SearchBox filters={EMPTY_FILTERS} onFiltersChange={vi.fn()} />)
    const input = screen.getByRole('textbox', { name: 'Search' })
    expect(input).toHaveAttribute('placeholder', 'Search by title, artist or composer')
  })

  it('shows clear button when query is non-empty', () => {
    const filtersWithQuery: AlbumFilters = { ...EMPTY_FILTERS, query: 'miles' }
    render(<SearchBox filters={filtersWithQuery} onFiltersChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Clear Search' })).toBeInTheDocument()
  })

  it('does not show clear button when query is empty', () => {
    render(<SearchBox filters={EMPTY_FILTERS} onFiltersChange={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Clear Search' })).not.toBeInTheDocument()
  })

  it('clears query and calls onFiltersChange when clear button is clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const filtersWithQuery: AlbumFilters = { ...EMPTY_FILTERS, query: 'miles' }
    render(<SearchBox filters={filtersWithQuery} onFiltersChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Clear Search' }))

    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, query: '' })
  })

  it('input reflects the current filters.query value (controlled)', () => {
    const filtersWithQuery: AlbumFilters = { ...EMPTY_FILTERS, query: 'beethoven' }
    render(<SearchBox filters={filtersWithQuery} onFiltersChange={vi.fn()} />)
    const input = screen.getByRole('textbox', { name: 'Search' })
    expect(input).toHaveValue('beethoven')
  })

  it('clears input display when filters.query is reset externally', async () => {
    const onChange = vi.fn()
    const filtersWithQuery: AlbumFilters = { ...EMPTY_FILTERS, query: 'miles' }
    const { rerender } = render(
      <SearchBox filters={filtersWithQuery} onFiltersChange={onChange} />,
    )
    const input = screen.getByRole('textbox', { name: 'Search' })
    expect(input).toHaveValue('miles')

    // Simulate parent resetting filters to empty
    rerender(<SearchBox filters={EMPTY_FILTERS} onFiltersChange={onChange} />)
    expect(input).toHaveValue('')
  })
})

describe('SearchBox debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls onFiltersChange after 150ms debounce on input', async () => {
    const onChange = vi.fn()
    render(<SearchBox filters={EMPTY_FILTERS} onFiltersChange={onChange} />)
    const input = screen.getByRole('textbox', { name: 'Search' })

    // Fire change event directly (bypasses userEvent timing issues with fake timers)
    fireEvent.change(input, { target: { value: 'beethoven' } })

    // Before debounce fires — should not have been called
    expect(onChange).not.toHaveBeenCalled()

    // Advance past debounce
    await act(async () => {
      vi.advanceTimersByTime(150)
    })

    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, query: 'beethoven' })
  })

  it('debounces rapid changes to a single call', async () => {
    const onChange = vi.fn()
    render(<SearchBox filters={EMPTY_FILTERS} onFiltersChange={onChange} />)
    const input = screen.getByRole('textbox', { name: 'Search' })

    // Fire multiple rapid changes
    fireEvent.change(input, { target: { value: 'b' } })

    await act(async () => {
      vi.advanceTimersByTime(50) // mid-debounce
    })

    fireEvent.change(input, { target: { value: 'beethoven' } })

    await act(async () => {
      vi.advanceTimersByTime(150) // final debounce fires
    })

    // Should only have been called once with the final value
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, query: 'beethoven' })
  })
})
