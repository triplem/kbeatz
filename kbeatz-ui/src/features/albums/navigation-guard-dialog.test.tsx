import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NavigationGuardDialog } from './navigation-guard-dialog'

function renderDialog(overrides: Partial<React.ComponentProps<typeof NavigationGuardDialog>> = {}) {
  const defaults = {
    open: true,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  }
  return render(<NavigationGuardDialog {...defaults} {...overrides} />)
}

describe('NavigationGuardDialog', () => {
  beforeEach(() => {
    document.body.style.overflow = ''
  })

  afterEach(() => {
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
    expect(screen.getByTestId('nav-guard-dialog')).toBeInTheDocument()
  })

  // ──────────────────────────────────────────────
  // Content + accessibility
  // ──────────────────────────────────────────────

  it('has a Stay-on-page button and a Leave-anyway button', () => {
    renderDialog()
    expect(screen.getByTestId('nav-guard-cancel')).toHaveTextContent('Stay on page')
    expect(screen.getByTestId('nav-guard-confirm')).toHaveTextContent('Leave anyway')
  })

  it('dialog element has role="dialog" and aria-modal="true"', () => {
    renderDialog()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('dialog has aria-labelledby pointing to a title element', () => {
    renderDialog()
    const dialog = screen.getByRole('dialog')
    const labelId = dialog.getAttribute('aria-labelledby')
    expect(labelId).not.toBeNull()
    const title = document.getElementById(labelId ?? '')
    expect(title).toBeInTheDocument()
    expect(title?.textContent).toMatch(/unsaved changes/i)
  })

  it('dialog has aria-describedby pointing to a body element', () => {
    renderDialog()
    const dialog = screen.getByRole('dialog')
    const bodyId = dialog.getAttribute('aria-describedby')
    expect(bodyId).not.toBeNull()
    const body = document.getElementById(bodyId ?? '')
    expect(body).toBeInTheDocument()
  })

  it('backdrop overlay carries role="presentation"', () => {
    renderDialog()
    expect(screen.getByTestId('nav-guard-overlay')).toHaveAttribute('role', 'presentation')
  })

  // ──────────────────────────────────────────────
  // Interactions
  // ──────────────────────────────────────────────

  it('calls onConfirm when Leave-anyway is clicked', () => {
    const onConfirm = vi.fn()
    renderDialog({ onConfirm })
    fireEvent.click(screen.getByTestId('nav-guard-confirm'))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('calls onCancel when Stay-on-page is clicked', () => {
    const onCancel = vi.fn()
    renderDialog({ onCancel })
    fireEvent.click(screen.getByTestId('nav-guard-cancel'))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('calls onCancel when Escape is pressed and does not confirm', () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    renderDialog({ onCancel, onConfirm })
    fireEvent.keyDown(screen.getByTestId('nav-guard-dialog'), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('calls onCancel when the overlay backdrop is clicked', () => {
    const onCancel = vi.fn()
    renderDialog({ onCancel })
    fireEvent.click(screen.getByTestId('nav-guard-overlay'))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('does NOT call onCancel when the dialog panel is clicked', () => {
    const onCancel = vi.fn()
    renderDialog({ onCancel })
    fireEvent.click(screen.getByTestId('nav-guard-dialog'))
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('ignores unrelated key presses', () => {
    const onCancel = vi.fn()
    renderDialog({ onCancel })
    fireEvent.keyDown(screen.getByTestId('nav-guard-dialog'), { key: 'Enter' })
    expect(onCancel).not.toHaveBeenCalled()
  })

  // ──────────────────────────────────────────────
  // Background scroll prevention
  // ──────────────────────────────────────────────

  it('sets body overflow to hidden while open', () => {
    renderDialog({ open: true })
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('restores body overflow when unmounted', () => {
    const { unmount } = renderDialog({ open: true })
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('')
  })

  // ──────────────────────────────────────────────
  // Tab-trap keyboard navigation
  // ──────────────────────────────────────────────

  it('wraps focus from confirm to cancel on Tab when confirm is focused', () => {
    renderDialog()
    const confirm = screen.getByTestId('nav-guard-confirm')
    const cancel = screen.getByTestId('nav-guard-cancel')
    confirm.focus()
    fireEvent.keyDown(screen.getByTestId('nav-guard-dialog'), { key: 'Tab', shiftKey: false })
    expect(document.activeElement).toBe(cancel)
  })

  it('wraps focus from cancel to confirm on Shift+Tab when cancel is focused', () => {
    renderDialog()
    const confirm = screen.getByTestId('nav-guard-confirm')
    const cancel = screen.getByTestId('nav-guard-cancel')
    cancel.focus()
    fireEvent.keyDown(screen.getByTestId('nav-guard-dialog'), { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(confirm)
  })

  it('does not wrap Tab when focus is not on the confirm button', () => {
    renderDialog()
    const cancel = screen.getByTestId('nav-guard-cancel')
    cancel.focus()
    fireEvent.keyDown(screen.getByTestId('nav-guard-dialog'), { key: 'Tab', shiftKey: false })
    expect(document.activeElement).toBe(cancel)
  })

  it('does not wrap Shift+Tab when focus is not on the cancel button', () => {
    renderDialog()
    const confirm = screen.getByTestId('nav-guard-confirm')
    confirm.focus()
    fireEvent.keyDown(screen.getByTestId('nav-guard-dialog'), { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(confirm)
  })

  it('restores focus to the previously focused element when closed', () => {
    const trigger = document.createElement('button')
    trigger.setAttribute('data-testid', 'external-trigger')
    document.body.appendChild(trigger)
    trigger.focus()

    const { rerender } = renderDialog({ open: true })
    // Focus moved into the dialog (Cancel is the safe default)
    expect(document.activeElement).toBe(screen.getByTestId('nav-guard-cancel'))

    act(() => {
      rerender(<NavigationGuardDialog open={false} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    })
    expect(document.activeElement).toBe(trigger)
    document.body.removeChild(trigger)
  })
})
