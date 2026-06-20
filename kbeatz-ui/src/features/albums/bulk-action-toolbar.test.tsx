import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { BulkActionToolbar } from './bulk-action-toolbar'

describe('BulkActionToolbar', () => {
  it('renders the selected count', () => {
    render(<BulkActionToolbar selectedCount={3} onReorganize={vi.fn()} onClear={vi.fn()} />)
    expect(screen.getByTestId('bulk-selected-count')).toHaveTextContent('3 albums selected')
  })

  it('renders singular count text for one album', () => {
    render(<BulkActionToolbar selectedCount={1} onReorganize={vi.fn()} onClear={vi.fn()} />)
    expect(screen.getByTestId('bulk-selected-count')).toHaveTextContent('1 album selected')
  })

  it('calls onReorganize when the reorganize button is clicked', async () => {
    const onReorganize = vi.fn()
    render(<BulkActionToolbar selectedCount={2} onReorganize={onReorganize} onClear={vi.fn()} />)
    await userEvent.click(screen.getByTestId('bulk-reorganize-button'))
    expect(onReorganize).toHaveBeenCalledOnce()
  })

  it('calls onClear when the clear button is clicked', async () => {
    const onClear = vi.fn()
    render(<BulkActionToolbar selectedCount={2} onReorganize={vi.fn()} onClear={onClear} />)
    await userEvent.click(screen.getByTestId('bulk-clear-button'))
    expect(onClear).toHaveBeenCalledOnce()
  })

  it('is exposed as a labelled toolbar', () => {
    render(<BulkActionToolbar selectedCount={1} onReorganize={vi.fn()} onClear={vi.fn()} />)
    expect(screen.getByRole('toolbar', { name: /Bulk album actions/ })).toBeInTheDocument()
  })
})
