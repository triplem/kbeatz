import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { DismissibleBanner } from './dismissible-banner'

describe('DismissibleBanner', () => {
  it('renders children content', () => {
    render(
      <DismissibleBanner onDismiss={vi.fn()}>
        Scan complete
      </DismissibleBanner>,
    )
    expect(screen.getByText('Scan complete')).toBeInTheDocument()
  })

  it('renders a dismiss button with accessible label', () => {
    render(
      <DismissibleBanner onDismiss={vi.fn()}>
        Content
      </DismissibleBanner>,
    )
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument()
  })

  it('calls onDismiss when the button is clicked', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(
      <DismissibleBanner onDismiss={onDismiss}>
        Content
      </DismissibleBanner>,
    )
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('applies className to the wrapper element', () => {
    const { container } = render(
      <DismissibleBanner onDismiss={vi.fn()} className="my-custom-class">
        Content
      </DismissibleBanner>,
    )
    expect(container.firstChild).toHaveClass('my-custom-class')
  })

  it('uses role="status" by default', () => {
    render(
      <DismissibleBanner onDismiss={vi.fn()}>
        Content
      </DismissibleBanner>,
    )
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('uses role="alert" when specified', () => {
    render(
      <DismissibleBanner onDismiss={vi.fn()} role="alert">
        Error content
      </DismissibleBanner>,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('does not render a dismiss button with role="alert" wrapper when role is status', () => {
    render(
      <DismissibleBanner onDismiss={vi.fn()}>
        Content
      </DismissibleBanner>,
    )
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
