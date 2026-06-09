import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { EditableField } from './editable-field'

describe('EditableField', () => {
  const defaultProps = {
    label: 'Genre',
    value: 'Jazz',
    fieldName: 'GENRE',
    onSave: vi.fn(),
    testIdPrefix: 'album',
  }

  // ──────────────────────────────────────────────
  // Initial render
  // ──────────────────────────────────────────────

  it('renders the current value as a button', () => {
    render(<EditableField {...defaultProps} />)
    expect(screen.getByTestId('album-value-genre')).toHaveTextContent('Jazz')
  })

  it('renders empty state when value is undefined', () => {
    render(<EditableField {...defaultProps} value={undefined} />)
    expect(screen.getByTestId('album-value-genre')).toBeInTheDocument()
  })

  // ──────────────────────────────────────────────
  // Click-to-edit activation
  // ──────────────────────────────────────────────

  it('shows input pre-filled with current value when clicked', () => {
    render(<EditableField {...defaultProps} />)
    fireEvent.click(screen.getByTestId('album-value-genre'))
    const input = screen.getByTestId('album-input-genre')
    expect(input).toBeInTheDocument()
    expect(input).toHaveValue('Jazz')
  })

  // ──────────────────────────────────────────────
  // Escape cancellation
  // ──────────────────────────────────────────────

  it('cancels edit and restores original value on Escape', () => {
    render(<EditableField {...defaultProps} />)
    fireEvent.click(screen.getByTestId('album-value-genre'))
    const input = screen.getByTestId('album-input-genre')
    fireEvent.change(input, { target: { value: 'Rock' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    // Input should be replaced by the display value button again
    expect(screen.queryByTestId('album-input-genre')).not.toBeInTheDocument()
    expect(screen.getByTestId('album-value-genre')).toHaveTextContent('Jazz')
  })

  it('does not call onSave on Escape', () => {
    const onSave = vi.fn()
    render(<EditableField {...defaultProps} onSave={onSave} />)
    fireEvent.click(screen.getByTestId('album-value-genre'))
    const input = screen.getByTestId('album-input-genre')
    fireEvent.change(input, { target: { value: 'Rock' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(onSave).not.toHaveBeenCalled()
  })

  // ──────────────────────────────────────────────
  // Enter save (success path)
  // ──────────────────────────────────────────────

  it('calls onSave with field and new value on Enter', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<EditableField {...defaultProps} onSave={onSave} />)
    fireEvent.click(screen.getByTestId('album-value-genre'))
    const input = screen.getByTestId('album-input-genre')
    fireEvent.change(input, { target: { value: 'Rock' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('GENRE', 'Rock')
    })
  })

  it('exits edit mode after successful save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<EditableField {...defaultProps} onSave={onSave} />)
    fireEvent.click(screen.getByTestId('album-value-genre'))
    const input = screen.getByTestId('album-input-genre')
    fireEvent.change(input, { target: { value: 'Rock' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(screen.queryByTestId('album-input-genre')).not.toBeInTheDocument()
    })
  })

  // ──────────────────────────────────────────────
  // Blur cancellation (not save)
  // ──────────────────────────────────────────────

  it('cancels edit silently on blur without calling onSave', async () => {
    const onSave = vi.fn()
    render(<EditableField {...defaultProps} onSave={onSave} />)
    fireEvent.click(screen.getByTestId('album-value-genre'))
    const input = screen.getByTestId('album-input-genre')
    fireEvent.change(input, { target: { value: 'Electronic' } })
    fireEvent.blur(input)

    await waitFor(() => {
      // Input gone, original value restored silently
      expect(screen.queryByTestId('album-input-genre')).not.toBeInTheDocument()
      expect(screen.getByTestId('album-value-genre')).toHaveTextContent('Jazz')
    })
    expect(onSave).not.toHaveBeenCalled()
  })

  it('cancels edit silently on blur even when value is unchanged', async () => {
    const onSave = vi.fn()
    render(<EditableField {...defaultProps} onSave={onSave} />)
    fireEvent.click(screen.getByTestId('album-value-genre'))
    // Do not change the value - just blur
    fireEvent.blur(screen.getByTestId('album-input-genre'))

    await waitFor(() => {
      expect(screen.queryByTestId('album-input-genre')).not.toBeInTheDocument()
    })
    expect(onSave).not.toHaveBeenCalled()
  })

  it('does not show error after blur cancellation', async () => {
    const onSave = vi.fn()
    render(<EditableField {...defaultProps} onSave={onSave} />)
    fireEvent.click(screen.getByTestId('album-value-genre'))
    fireEvent.change(screen.getByTestId('album-input-genre'), { target: { value: 'Electronic' } })
    fireEvent.blur(screen.getByTestId('album-input-genre'))

    await waitFor(() => {
      expect(screen.queryByTestId('album-input-genre')).not.toBeInTheDocument()
    })
    expect(screen.queryByTestId('album-error-genre')).not.toBeInTheDocument()
  })

  // ──────────────────────────────────────────────
  // Error path + rollback
  // ──────────────────────────────────────────────

  it('shows error message and rolls back when onSave throws', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Save failed: server error'))
    render(<EditableField {...defaultProps} onSave={onSave} />)
    fireEvent.click(screen.getByTestId('album-value-genre'))
    const input = screen.getByTestId('album-input-genre')
    fireEvent.change(input, { target: { value: 'Rock' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      // Input gone, display value restored
      expect(screen.queryByTestId('album-input-genre')).not.toBeInTheDocument()
      expect(screen.getByTestId('album-value-genre')).toHaveTextContent('Jazz')
      // Error message shown
      expect(screen.getByTestId('album-error-genre')).toHaveTextContent('Save failed: server error')
    })
  })

  it('error is cleared when next edit begins', async () => {
    const onSave = vi.fn().mockRejectedValueOnce(new Error('Save failed'))
    render(<EditableField {...defaultProps} onSave={onSave} />)

    // First edit: fails
    fireEvent.click(screen.getByTestId('album-value-genre'))
    fireEvent.change(screen.getByTestId('album-input-genre'), { target: { value: 'Rock' } })
    fireEvent.keyDown(screen.getByTestId('album-input-genre'), { key: 'Enter' })
    await waitFor(() => {
      expect(screen.getByTestId('album-error-genre')).toBeInTheDocument()
    })

    // Second edit: error clears
    fireEvent.click(screen.getByTestId('album-value-genre'))
    expect(screen.queryByTestId('album-error-genre')).not.toBeInTheDocument()
  })

  // ──────────────────────────────────────────────
  // No change: skip API call
  // ──────────────────────────────────────────────

  it('does not call onSave when value is unchanged on Enter', async () => {
    const onSave = vi.fn()
    render(<EditableField {...defaultProps} onSave={onSave} />)
    fireEvent.click(screen.getByTestId('album-value-genre'))
    // Do not change the value
    fireEvent.keyDown(screen.getByTestId('album-input-genre'), { key: 'Enter' })

    await waitFor(() => {
      expect(onSave).not.toHaveBeenCalled()
      expect(screen.queryByTestId('album-input-genre')).not.toBeInTheDocument()
    })
  })

  // ──────────────────────────────────────────────
  // Specific error messages (#384)
  // ──────────────────────────────────────────────

  it('shows timeout error message when save fails with AbortError', async () => {
    const abortError = new DOMException('The operation was aborted', 'AbortError')
    const onSave = vi.fn().mockRejectedValue(abortError)
    render(<EditableField {...defaultProps} onSave={onSave} />)

    fireEvent.click(screen.getByTestId('album-value-genre'))
    await userEvent.clear(screen.getByTestId('album-input-genre'))
    await userEvent.type(screen.getByTestId('album-input-genre'), 'NewValue')
    fireEvent.keyDown(screen.getByTestId('album-input-genre'), { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByTestId('album-error-genre')).toHaveTextContent(
        'Save failed: request timed out',
      )
    })
  })

  it('shows server error message when save fails with HTTP 500', async () => {
    const serverError = { status: 500, message: 'Internal Server Error' }
    const onSave = vi.fn().mockRejectedValue(serverError)
    render(<EditableField {...defaultProps} onSave={onSave} />)

    fireEvent.click(screen.getByTestId('album-value-genre'))
    await userEvent.clear(screen.getByTestId('album-input-genre'))
    await userEvent.type(screen.getByTestId('album-input-genre'), 'NewValue')
    fireEvent.keyDown(screen.getByTestId('album-input-genre'), { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByTestId('album-error-genre')).toHaveTextContent(
        'Save failed: server error',
      )
    })
  })

  it('shows unreachable error message when save fails with fetch TypeError', async () => {
    const fetchError = new TypeError('Failed to fetch')
    const onSave = vi.fn().mockRejectedValue(fetchError)
    render(<EditableField {...defaultProps} onSave={onSave} />)

    fireEvent.click(screen.getByTestId('album-value-genre'))
    await userEvent.clear(screen.getByTestId('album-input-genre'))
    await userEvent.type(screen.getByTestId('album-input-genre'), 'NewValue')
    fireEvent.keyDown(screen.getByTestId('album-input-genre'), { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByTestId('album-error-genre')).toHaveTextContent(
        'Save failed: could not reach kbeatz-catalog',
      )
    })
  })
})
