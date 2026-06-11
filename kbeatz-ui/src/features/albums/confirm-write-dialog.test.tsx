import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ConfirmWriteDialog } from './confirm-write-dialog'

function renderDialog(overrides: Partial<React.ComponentProps<typeof ConfirmWriteDialog>> = {}) {
  const defaults = {
    open: true,
    albumTitle: 'Kind of Blue',
    trackCount: 10,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  }
  return render(<ConfirmWriteDialog {...defaults} {...overrides} />)
}

describe('ConfirmWriteDialog', () => {
  beforeEach(() => {
    // Reset overflow before each test to avoid test pollution
    document.body.style.overflow = ''
  })

  afterEach(() => {
    // Ensure overflow is always restored after each test
    document.body.style.overflow = ''
  })

  // ──────────────────────────────────────────────
  // Visibility
  // ──────────────────────────────────────────────

  it('renders nothing when open is false', () => {
    const { container } = renderDialog({ open: false })
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the dialog when open is true', () => {
    renderDialog({ open: true })
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
  })

  // ──────────────────────────────────────────────
  // Content
  // ──────────────────────────────────────────────

  it('displays the album title', () => {
    renderDialog({ albumTitle: 'Abbey Road' })
    expect(screen.getByTestId('confirm-dialog')).toHaveTextContent('Abbey Road')
  })

  it('displays singular "1 FLAC file" for a single track', () => {
    renderDialog({ trackCount: 1 })
    expect(screen.getByTestId('confirm-dialog')).toHaveTextContent('1 FLAC file')
    expect(screen.getByTestId('confirm-dialog')).not.toHaveTextContent('1 FLAC files')
  })

  it('displays plural "N FLAC files" for multiple tracks', () => {
    renderDialog({ trackCount: 30 })
    expect(screen.getByTestId('confirm-dialog')).toHaveTextContent('30 FLAC files')
  })

  it('shows "This cannot be undone" warning', () => {
    renderDialog()
    expect(screen.getByTestId('confirm-dialog-warning')).toHaveTextContent('This cannot be undone')
  })

  it('has a Cancel button and a Write tags button', () => {
    renderDialog()
    expect(screen.getByTestId('confirm-dialog-cancel')).toHaveTextContent('Cancel')
    expect(screen.getByTestId('confirm-dialog-confirm')).toHaveTextContent('Write tags')
  })

  // ──────────────────────────────────────────────
  // Accessibility
  // ──────────────────────────────────────────────

  it('dialog element has role="dialog"', () => {
    renderDialog()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('dialog element has aria-modal="true"', () => {
    renderDialog()
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })

  it('dialog element has aria-labelledby pointing to the title', () => {
    renderDialog()
    const dialog = screen.getByRole('dialog')
    const labelId = dialog.getAttribute('aria-labelledby')
    expect(labelId).not.toBeNull()
    const title = document.getElementById(labelId ?? '')
    expect(title).toBeInTheDocument()
    expect(title?.textContent).toMatch(/Write tags/)
  })

  it('dialog element has aria-describedby referencing body and warning paragraphs', () => {
    renderDialog()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-describedby', 'confirm-dialog-body confirm-dialog-warning')
  })

  it('aria-describedby body paragraph exists with an id and contains album info', () => {
    renderDialog({ albumTitle: 'Kind of Blue', trackCount: 5 })
    const bodyEl = document.getElementById('confirm-dialog-body')
    expect(bodyEl).toBeInTheDocument()
    expect(bodyEl?.textContent).toMatch(/5 FLAC files/)
    expect(bodyEl?.textContent).toMatch(/Kind of Blue/)
  })

  it('aria-describedby warning paragraph exists with an id and contains cannot be undone', () => {
    renderDialog()
    const warningEl = document.getElementById('confirm-dialog-warning')
    expect(warningEl).toBeInTheDocument()
    expect(warningEl?.textContent).toMatch(/This cannot be undone/)
  })

  it('backdrop overlay carries role="presentation" (#485 - WCAG AA)', () => {
    renderDialog()
    const overlay = screen.getByTestId('confirm-dialog-overlay')
    // The backdrop must not be exposed as an unlabelled interactive element;
    // role="presentation" removes it from the accessibility tree.
    expect(overlay).toHaveAttribute('role', 'presentation')
  })

  // ──────────────────────────────────────────────
  // Interactions
  // ──────────────────────────────────────────────

  it('calls onConfirm when Write tags button is clicked', () => {
    const onConfirm = vi.fn()
    renderDialog({ onConfirm })
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('calls onCancel when Cancel button is clicked', () => {
    const onCancel = vi.fn()
    renderDialog({ onCancel })
    fireEvent.click(screen.getByTestId('confirm-dialog-cancel'))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('calls onCancel when Escape key is pressed on the dialog', () => {
    const onCancel = vi.fn()
    renderDialog({ onCancel })
    fireEvent.keyDown(screen.getByTestId('confirm-dialog'), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('does NOT call onConfirm when Escape key is pressed', () => {
    const onConfirm = vi.fn()
    renderDialog({ onConfirm })
    fireEvent.keyDown(screen.getByTestId('confirm-dialog'), { key: 'Escape' })
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('calls onCancel when clicking the overlay backdrop', () => {
    const onCancel = vi.fn()
    renderDialog({ onCancel })
    fireEvent.click(screen.getByTestId('confirm-dialog-overlay'))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('does NOT call onCancel when clicking inside the dialog panel', () => {
    const onCancel = vi.fn()
    renderDialog({ onCancel })
    // Click the dialog panel itself (not the overlay)
    fireEvent.click(screen.getByTestId('confirm-dialog'))
    expect(onCancel).not.toHaveBeenCalled()
  })

  // ──────────────────────────────────────────────
  // Background scroll prevention
  // ──────────────────────────────────────────────

  it('sets body overflow to hidden when dialog is open', () => {
    renderDialog({ open: true })
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('does not set body overflow to hidden when dialog is closed', () => {
    renderDialog({ open: false })
    expect(document.body.style.overflow).not.toBe('hidden')
  })

  it('restores body overflow when dialog is unmounted', () => {
    const { unmount } = renderDialog({ open: true })
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('restores body overflow when dialog transitions from open to closed', () => {
    const { rerender } = renderDialog({ open: true })
    expect(document.body.style.overflow).toBe('hidden')
    act(() => {
      rerender(
        <ConfirmWriteDialog
          open={false}
          albumTitle="Kind of Blue"
          trackCount={10}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      )
    })
    expect(document.body.style.overflow).toBe('')
  })

  // ──────────────────────────────────────────────
  // Tab-trap keyboard navigation
  // ──────────────────────────────────────────────

  it('wraps focus from confirm to cancel on Tab when confirm is focused', () => {
    renderDialog()
    const confirm = screen.getByTestId('confirm-dialog-confirm')
    const cancel = screen.getByTestId('confirm-dialog-cancel')
    confirm.focus()
    fireEvent.keyDown(screen.getByTestId('confirm-dialog'), { key: 'Tab', shiftKey: false })
    expect(document.activeElement).toBe(cancel)
  })

  it('wraps focus from cancel to confirm on Shift+Tab when cancel is focused', () => {
    renderDialog()
    const confirm = screen.getByTestId('confirm-dialog-confirm')
    const cancel = screen.getByTestId('confirm-dialog-cancel')
    cancel.focus()
    fireEvent.keyDown(screen.getByTestId('confirm-dialog'), { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(confirm)
  })

  it('does not wrap Tab when focus is not on the confirm button', () => {
    renderDialog()
    const cancel = screen.getByTestId('confirm-dialog-cancel')
    cancel.focus()
    // Tab forward from cancel - should not redirect
    fireEvent.keyDown(screen.getByTestId('confirm-dialog'), { key: 'Tab', shiftKey: false })
    // Focus should stay on cancel (no redirect because active is not confirm)
    expect(document.activeElement).toBe(cancel)
  })

  it('does not wrap Shift+Tab when focus is not on the cancel button', () => {
    renderDialog()
    const confirm = screen.getByTestId('confirm-dialog-confirm')
    confirm.focus()
    // Shift+Tab from confirm - should not redirect because active is not cancel
    fireEvent.keyDown(screen.getByTestId('confirm-dialog'), { key: 'Tab', shiftKey: true })
    // Focus should stay on confirm
    expect(document.activeElement).toBe(confirm)
  })

  it('ignores unrelated key presses', () => {
    const onCancel = vi.fn()
    renderDialog({ onCancel })
    fireEvent.keyDown(screen.getByTestId('confirm-dialog'), { key: 'Enter' })
    expect(onCancel).not.toHaveBeenCalled()
  })
})
