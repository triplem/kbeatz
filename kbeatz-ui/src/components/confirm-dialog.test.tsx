import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ConfirmDialog } from './confirm-dialog'

interface RenderOptions {
  readonly open?: boolean
  readonly warning?: string
  readonly onConfirm?: () => void
  readonly onCancel?: () => void
}

function renderDialog({ open = true, warning, onConfirm = vi.fn(), onCancel = vi.fn() }: RenderOptions = {}) {
  return render(
    <ConfirmDialog
      open={open}
      title="Confirm action"
      body="Are you sure?"
      warning={warning}
      confirmLabel="Yes"
      cancelLabel="No"
      onConfirm={onConfirm}
      onCancel={onCancel}
      testId="confirm"
    />,
  )
}

describe('ConfirmDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = renderDialog({ open: false })
    expect(container.firstChild).toBeNull()
  })

  it('renders an accessible modal dialog when open', () => {
    renderDialog()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('Confirm action')).toBeInTheDocument()
    expect(screen.getByText('Are you sure?')).toBeInTheDocument()
  })

  it('renders the optional warning text', () => {
    renderDialog({ warning: 'This cannot be undone' })
    expect(screen.getByText('This cannot be undone')).toBeInTheDocument()
  })

  it('calls onConfirm when the confirm button is clicked', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    renderDialog({ onConfirm })
    await user.click(screen.getByRole('button', { name: 'Yes' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when the cancel button is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    renderDialog({ onCancel })
    await user.click(screen.getByRole('button', { name: 'No' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when Escape is pressed', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    renderDialog({ onCancel })
    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when the backdrop is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    renderDialog({ onCancel })
    await user.click(screen.getByTestId('confirm-overlay'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('does not dismiss when the dialog panel itself is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    renderDialog({ onCancel })
    await user.click(screen.getByText('Are you sure?'))
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('moves focus to the cancel button when opened', () => {
    renderDialog()
    expect(screen.getByRole('button', { name: 'No' })).toHaveFocus()
  })

  it('wraps focus from cancel to confirm on Shift+Tab', async () => {
    const user = userEvent.setup()
    renderDialog()
    // Focus starts on Cancel; Shift+Tab wraps to Confirm.
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Yes' })).toHaveFocus()
  })

  it('wraps focus from confirm back to cancel on Tab', async () => {
    const user = userEvent.setup()
    renderDialog()
    screen.getByRole('button', { name: 'Yes' }).focus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'No' })).toHaveFocus()
  })

  it('restores focus to the trigger when the dialog closes', () => {
    const trigger = document.createElement('button')
    trigger.textContent = 'Open'
    document.body.appendChild(trigger)
    trigger.focus()

    const { rerender } = render(
      <ConfirmDialog
        open
        title="T"
        body="B"
        confirmLabel="Yes"
        cancelLabel="No"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        testId="confirm"
      />,
    )
    // Closing should return focus to the previously focused trigger.
    rerender(
      <ConfirmDialog
        open={false}
        title="T"
        body="B"
        confirmLabel="Yes"
        cancelLabel="No"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        testId="confirm"
      />,
    )
    expect(trigger).toHaveFocus()
    trigger.remove()
  })
})
