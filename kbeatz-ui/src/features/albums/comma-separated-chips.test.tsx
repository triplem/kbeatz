import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { CommaSeparatedChips } from './comma-separated-chips'

describe('CommaSeparatedChips', () => {
  it('renders a chip for each comma-separated value', () => {
    render(<CommaSeparatedChips value="Jazz, Blues, Soul" ariaLabel="Genres" testId="chips" />)
    const list = screen.getByTestId('chips')
    expect(list).toHaveTextContent('Jazz')
    expect(list).toHaveTextContent('Blues')
    expect(list).toHaveTextContent('Soul')
  })

  it('trims whitespace from each segment', () => {
    render(<CommaSeparatedChips value="  Jazz  ,  Blues  " ariaLabel="Genres" testId="chips" />)
    expect(screen.getByTestId('chips')).toHaveTextContent('Jazz')
    expect(screen.getByTestId('chips')).toHaveTextContent('Blues')
  })

  it('returns null when value is undefined', () => {
    const { container } = render(<CommaSeparatedChips value={undefined} ariaLabel="Genres" testId="chips" />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null when value is empty string', () => {
    const { container } = render(<CommaSeparatedChips value="" ariaLabel="Genres" testId="chips" />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null when all segments are empty after trimming', () => {
    const { container } = render(<CommaSeparatedChips value="  ,  ,  " ariaLabel="Genres" testId="chips" />)
    expect(container.firstChild).toBeNull()
  })

  it('applies the ariaLabel to the list', () => {
    render(<CommaSeparatedChips value="Jazz" ariaLabel="Genre tags" testId="chips" />)
    expect(screen.getByRole('list', { name: 'Genre tags' })).toBeInTheDocument()
  })

  it('applies testId when provided', () => {
    render(<CommaSeparatedChips value="Jazz" ariaLabel="Genres" testId="my-chips" />)
    expect(screen.getByTestId('my-chips')).toBeInTheDocument()
  })

  it('renders without testId when not provided', () => {
    render(<CommaSeparatedChips value="Jazz" ariaLabel="Genres" />)
    expect(screen.getByRole('list', { name: 'Genres' })).toBeInTheDocument()
  })

  it('renders a single chip for a single value', () => {
    render(<CommaSeparatedChips value="Jazz" ariaLabel="Genres" testId="chips" />)
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(1)
  })

  it('renders without error when duplicate values are present', () => {
    // Duplicate values produce duplicate React keys - component should still mount
    render(<CommaSeparatedChips value="Jazz, Jazz" ariaLabel="Genres" testId="chips" />)
    expect(screen.getByTestId('chips')).toBeInTheDocument()
  })
})
