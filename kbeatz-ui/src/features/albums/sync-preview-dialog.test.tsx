import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SyncPreviewDialog } from './sync-preview-dialog'
import type { SyncFieldChange } from '../../api/generated'

const SAMPLE_CHANGES: SyncFieldChange[] = [
  { field: 'GENRE', currentValue: 'Jazz', proposedValue: 'Modal Jazz' },
  { field: 'DATE', currentValue: '', proposedValue: '1959' },
]

function renderDialog(overrides: Partial<React.ComponentProps<typeof SyncPreviewDialog>> = {}) {
  const defaults = {
    open: true,
    loading: false,
    error: null,
    changes: SAMPLE_CHANGES,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  }
  return render(<SyncPreviewDialog {...defaults} {...overrides} />)
}

describe('SyncPreviewDialog', () => {
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
    expect(screen.getByTestId('sync-preview-dialog')).toBeInTheDocument()
  })

  // ──────────────────────────────────────────────
  // Loading state
  // ──────────────────────────────────────────────

  it('shows loading indicator when loading is true', () => {
    renderDialog({ loading: true, changes: [] })
    expect(screen.getByTestId('sync-preview-loading')).toBeInTheDocument()
  })

  it('loading indicator has role=status and aria-live=polite', () => {
    renderDialog({ loading: true, changes: [] })
    const loading = screen.getByTestId('sync-preview-loading')
    expect(loading).toHaveAttribute('role', 'status')
    expect(loading).toHaveAttribute('aria-live', 'polite')
  })

  it('confirm button is disabled while loading', () => {
    renderDialog({ loading: true, changes: [] })
    expect(screen.getByTestId('sync-preview-confirm')).toBeDisabled()
  })

  // ──────────────────────────────────────────────
  // Error state
  // ──────────────────────────────────────────────

  it('shows error message when error is set', () => {
    renderDialog({ loading: false, error: 'Discogs unavailable', changes: [] })
    expect(screen.getByTestId('sync-preview-error')).toBeInTheDocument()
    expect(screen.getByTestId('sync-preview-error')).toHaveTextContent('Discogs unavailable')
  })

  it('error element has role=alert', () => {
    renderDialog({ loading: false, error: 'Discogs unavailable', changes: [] })
    expect(screen.getByTestId('sync-preview-error')).toHaveAttribute('role', 'alert')
  })

  it('confirm button is disabled when error is set', () => {
    renderDialog({ loading: false, error: 'Discogs unavailable', changes: [] })
    expect(screen.getByTestId('sync-preview-confirm')).toBeDisabled()
  })

  // ──────────────────────────────────────────────
  // Empty state (no changes)
  // ──────────────────────────────────────────────

  it('shows no-changes message when changes is empty and not loading', () => {
    renderDialog({ loading: false, error: null, changes: [] })
    expect(screen.getByTestId('sync-preview-no-changes')).toBeInTheDocument()
  })

  it('no-changes message does not appear when there are changes', () => {
    renderDialog({ loading: false, error: null, changes: SAMPLE_CHANGES })
    expect(screen.queryByTestId('sync-preview-no-changes')).not.toBeInTheDocument()
  })

  it('confirm button is enabled when no changes (user can still proceed)', () => {
    renderDialog({ loading: false, error: null, changes: [] })
    expect(screen.getByTestId('sync-preview-confirm')).not.toBeDisabled()
  })

  // ──────────────────────────────────────────────
  // Changes table
  // ──────────────────────────────────────────────

  it('renders proposed changes table when changes are present', () => {
    renderDialog()
    expect(screen.getByTestId('sync-preview-table')).toBeInTheDocument()
  })

  it('renders one row per proposed change', () => {
    renderDialog({ changes: SAMPLE_CHANGES })
    expect(screen.getByTestId('sync-preview-row-GENRE')).toBeInTheDocument()
    expect(screen.getByTestId('sync-preview-row-DATE')).toBeInTheDocument()
  })

  it('shows field name, current value and proposed value in each row', () => {
    renderDialog({ changes: SAMPLE_CHANGES })
    const genreRow = screen.getByTestId('sync-preview-row-GENRE')
    expect(genreRow).toHaveTextContent('GENRE')
    expect(genreRow).toHaveTextContent('Jazz')
    expect(genreRow).toHaveTextContent('Modal Jazz')
  })

  it('shows (empty) placeholder when currentValue is an empty string', () => {
    renderDialog({ changes: SAMPLE_CHANGES })
    const dateRow = screen.getByTestId('sync-preview-row-DATE')
    expect(dateRow).toHaveTextContent('(empty)')
    expect(dateRow).toHaveTextContent('1959')
  })

  it('does not render the table when changes is empty', () => {
    renderDialog({ loading: false, error: null, changes: [] })
    expect(screen.queryByTestId('sync-preview-table')).not.toBeInTheDocument()
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
    expect(title?.textContent).toMatch(/Preview/)
  })

  it('dialog element has aria-busy=true while loading', () => {
    renderDialog({ loading: true, changes: [] })
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-busy', 'true')
  })

  it('backdrop overlay carries role="presentation"', () => {
    renderDialog()
    const overlay = screen.getByTestId('sync-preview-overlay')
    expect(overlay).toHaveAttribute('role', 'presentation')
  })

  it('has a Cancel button and a Confirm sync button', () => {
    renderDialog()
    expect(screen.getByTestId('sync-preview-cancel')).toBeInTheDocument()
    expect(screen.getByTestId('sync-preview-confirm')).toBeInTheDocument()
  })

  // ──────────────────────────────────────────────
  // Interactions
  // ──────────────────────────────────────────────

  it('calls onConfirm when Confirm sync button is clicked', () => {
    const onConfirm = vi.fn()
    renderDialog({ onConfirm })
    fireEvent.click(screen.getByTestId('sync-preview-confirm'))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('calls onCancel when Cancel button is clicked', () => {
    const onCancel = vi.fn()
    renderDialog({ onCancel })
    fireEvent.click(screen.getByTestId('sync-preview-cancel'))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('calls onCancel when Escape key is pressed on the dialog', () => {
    const onCancel = vi.fn()
    renderDialog({ onCancel })
    fireEvent.keyDown(screen.getByTestId('sync-preview-dialog'), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('does NOT call onConfirm when Escape key is pressed', () => {
    const onConfirm = vi.fn()
    renderDialog({ onConfirm })
    fireEvent.keyDown(screen.getByTestId('sync-preview-dialog'), { key: 'Escape' })
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('calls onCancel when clicking the overlay backdrop', () => {
    const onCancel = vi.fn()
    renderDialog({ onCancel })
    fireEvent.click(screen.getByTestId('sync-preview-overlay'))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('does NOT call onCancel when clicking inside the dialog panel', () => {
    const onCancel = vi.fn()
    renderDialog({ onCancel })
    fireEvent.click(screen.getByTestId('sync-preview-dialog'))
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
        <SyncPreviewDialog
          open={false}
          loading={false}
          error={null}
          changes={[]}
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
    const confirm = screen.getByTestId('sync-preview-confirm')
    const cancel = screen.getByTestId('sync-preview-cancel')
    confirm.focus()
    fireEvent.keyDown(screen.getByTestId('sync-preview-dialog'), { key: 'Tab', shiftKey: false })
    expect(document.activeElement).toBe(cancel)
  })

  it('wraps focus from cancel to confirm on Shift+Tab when cancel is focused', () => {
    renderDialog()
    const confirm = screen.getByTestId('sync-preview-confirm')
    const cancel = screen.getByTestId('sync-preview-cancel')
    cancel.focus()
    fireEvent.keyDown(screen.getByTestId('sync-preview-dialog'), { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(confirm)
  })
})
