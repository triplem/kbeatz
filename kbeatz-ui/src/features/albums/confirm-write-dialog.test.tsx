import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
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
})
