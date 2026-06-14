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
  // Label association (#485 - WCAG AA)
  // ──────────────────────────────────────────────

  it('associates a programmatic label with the edit input', () => {
    render(<EditableField {...defaultProps} />)
    fireEvent.click(screen.getByTestId('album-value-genre'))

    // getByLabelText resolves the input only when a <label htmlFor> (or aria
    // label) is programmatically associated. It would throw if the input had
    // no accessible name, so this asserts the label/input pairing directly.
    const labelledInput = screen.getByLabelText('Edit Genre')
    expect(labelledInput).toBe(screen.getByTestId('album-input-genre'))
    expect(labelledInput.tagName).toBe('INPUT')
  })

  it('gives the edit input an id matching the label htmlFor', () => {
    render(<EditableField {...defaultProps} />)
    fireEvent.click(screen.getByTestId('album-value-genre'))
    const input = screen.getByTestId('album-input-genre')
    const label = screen.getByText('Edit Genre')

    expect(input).toHaveAttribute('id', 'album-input-genre')
    expect(label).toHaveAttribute('for', 'album-input-genre')
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
  // Bug #541 fix 1: blur during save does not cancel
  // ──────────────────────────────────────────────

  it('does not cancel editing when blur fires while saving is in progress', async () => {
    // Simulate a slow onSave - the confirm dialog stealing focus fires blur
    // while saving === true; the field must stay in editing mode until save resolves.
    let resolveSave!: () => void
    const onSave = vi.fn(
      () => new Promise<void>((resolve) => { resolveSave = resolve }),
    )

    render(<EditableField {...defaultProps} onSave={onSave} />)
    fireEvent.click(screen.getByTestId('album-value-genre'))
    fireEvent.change(screen.getByTestId('album-input-genre'), { target: { value: 'Rock' } })
    fireEvent.keyDown(screen.getByTestId('album-input-genre'), { key: 'Enter' })

    // At this point saving is in flight; simulate blur (dialog stole focus)
    fireEvent.blur(screen.getByTestId('album-input-genre'))

    // Input must still be present - blur must not have cancelled the edit
    expect(screen.getByTestId('album-input-genre')).toBeInTheDocument()

    // Let the save finish
    resolveSave()
    await waitFor(() => {
      expect(screen.queryByTestId('album-input-genre')).not.toBeInTheDocument()
    })
  })

  // ──────────────────────────────────────────────
  // Bug #541 fix 2: hint shown on Tab-discard
  // ──────────────────────────────────────────────

  it('shows hint when blur discards a changed value', async () => {
    render(<EditableField {...defaultProps} />)
    fireEvent.click(screen.getByTestId('album-value-genre'))
    fireEvent.change(screen.getByTestId('album-input-genre'), { target: { value: 'Electronic' } })
    fireEvent.blur(screen.getByTestId('album-input-genre'))

    await waitFor(() => {
      expect(screen.getByTestId('album-hint-genre')).toBeInTheDocument()
    })
  })

  it('does not show hint when blur discards an unchanged value', async () => {
    render(<EditableField {...defaultProps} />)
    fireEvent.click(screen.getByTestId('album-value-genre'))
    // Do not change the value - just blur
    fireEvent.blur(screen.getByTestId('album-input-genre'))

    await waitFor(() => {
      expect(screen.queryByTestId('album-input-genre')).not.toBeInTheDocument()
    })
    expect(screen.queryByTestId('album-hint-genre')).not.toBeInTheDocument()
  })

  it('clears hint when next edit begins', async () => {
    render(<EditableField {...defaultProps} />)
    // First edit: blur with changed value shows hint
    fireEvent.click(screen.getByTestId('album-value-genre'))
    fireEvent.change(screen.getByTestId('album-input-genre'), { target: { value: 'Electronic' } })
    fireEvent.blur(screen.getByTestId('album-input-genre'))

    await waitFor(() => {
      expect(screen.getByTestId('album-hint-genre')).toBeInTheDocument()
    })

    // Second edit: hint must be gone
    fireEvent.click(screen.getByTestId('album-value-genre'))
    expect(screen.queryByTestId('album-hint-genre')).not.toBeInTheDocument()
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

  it('shows generic save-failed message when InternalSentinelError fires, not the raw developer string', async () => {
    // Simulates the sentinel onSave from album-detail.tsx being called unexpectedly.
    // classifyTagWriteError must map err.name === 'InternalSentinelError' to the
    // generic i18n key rather than exposing the developer-facing error.message.
    const sentinelErr = new Error('Album field onSave called unexpectedly - use onCommit')
    sentinelErr.name = 'InternalSentinelError'
    const onSave = vi.fn().mockRejectedValue(sentinelErr)
    render(<EditableField {...defaultProps} onSave={onSave} />)

    fireEvent.click(screen.getByTestId('album-value-genre'))
    await userEvent.clear(screen.getByTestId('album-input-genre'))
    await userEvent.type(screen.getByTestId('album-input-genre'), 'NewValue')
    fireEvent.keyDown(screen.getByTestId('album-input-genre'), { key: 'Enter' })

    await waitFor(() => {
      // Must show the generic user-facing message, NOT the developer string
      expect(screen.getByTestId('album-error-genre')).not.toHaveTextContent(
        'Album field onSave called unexpectedly - use onCommit',
      )
      expect(screen.getByTestId('album-error-genre')).toHaveTextContent('Save failed')
    })
  })

  // ──────────────────────────────────────────────
  // onCommit dirty-mode (#654)
  // ──────────────────────────────────────────────

  describe('when onCommit is provided (dirty-commit mode)', () => {
    const commitProps = {
      label: 'Genre',
      value: 'Jazz',
      fieldName: 'GENRE',
      onSave: vi.fn(),
      onCommit: vi.fn(),
      testIdPrefix: 'album',
    }

    it('Enter calls onCommit instead of onSave', async () => {
      const onCommit = vi.fn()
      const onSave = vi.fn()
      render(<EditableField {...commitProps} onCommit={onCommit} onSave={onSave} />)

      fireEvent.click(screen.getByTestId('album-value-genre'))
      fireEvent.change(screen.getByTestId('album-input-genre'), { target: { value: 'Rock' } })
      fireEvent.keyDown(screen.getByTestId('album-input-genre'), { key: 'Enter' })

      await waitFor(() => {
        expect(onCommit).toHaveBeenCalledWith('GENRE', 'Rock')
      })
      expect(onSave).not.toHaveBeenCalled()
    })

    it('Tab calls onCommit and exits edit mode', async () => {
      const onCommit = vi.fn()
      render(<EditableField {...commitProps} onCommit={onCommit} />)

      fireEvent.click(screen.getByTestId('album-value-genre'))
      fireEvent.change(screen.getByTestId('album-input-genre'), { target: { value: 'Electronic' } })
      fireEvent.keyDown(screen.getByTestId('album-input-genre'), { key: 'Tab' })

      await waitFor(() => {
        expect(onCommit).toHaveBeenCalledWith('GENRE', 'Electronic')
        expect(screen.queryByTestId('album-input-genre')).not.toBeInTheDocument()
      })
    })

    it('Tab does not show "changes discarded" hint', async () => {
      const onCommit = vi.fn()
      render(<EditableField {...commitProps} onCommit={onCommit} />)

      fireEvent.click(screen.getByTestId('album-value-genre'))
      fireEvent.change(screen.getByTestId('album-input-genre'), { target: { value: 'Electronic' } })
      fireEvent.keyDown(screen.getByTestId('album-input-genre'), { key: 'Tab' })
      // Simulate the blur that the browser fires after Tab
      const input = screen.queryByTestId('album-input-genre')
      if (input !== null) fireEvent.blur(input)

      await waitFor(() => {
        expect(screen.queryByTestId('album-input-genre')).not.toBeInTheDocument()
      })
      expect(screen.queryByTestId('album-hint-genre')).not.toBeInTheDocument()
    })

    it('committed value is shown in display mode after Tab commit', async () => {
      const onCommit = vi.fn()
      render(<EditableField {...commitProps} onCommit={onCommit} />)

      fireEvent.click(screen.getByTestId('album-value-genre'))
      fireEvent.change(screen.getByTestId('album-input-genre'), { target: { value: 'Folk' } })
      fireEvent.keyDown(screen.getByTestId('album-input-genre'), { key: 'Tab' })

      await waitFor(() => {
        expect(screen.queryByTestId('album-input-genre')).not.toBeInTheDocument()
        // Display shows the committed pending value, not the original 'Jazz'
        expect(screen.getByTestId('album-value-genre')).toHaveTextContent('Folk')
      })
    })

    it('clicking a dirty-committed field pre-fills with the committed value', async () => {
      const onCommit = vi.fn()
      render(<EditableField {...commitProps} onCommit={onCommit} />)

      // First commit: Tab
      fireEvent.click(screen.getByTestId('album-value-genre'))
      fireEvent.change(screen.getByTestId('album-input-genre'), { target: { value: 'Folk' } })
      fireEvent.keyDown(screen.getByTestId('album-input-genre'), { key: 'Tab' })

      await waitFor(() => {
        expect(screen.queryByTestId('album-input-genre')).not.toBeInTheDocument()
      })

      // Re-open the field - should pre-fill with 'Folk' (committed value), not 'Jazz'
      fireEvent.click(screen.getByTestId('album-value-genre'))
      expect(screen.getByTestId('album-input-genre')).toHaveValue('Folk')
    })
  })
})
