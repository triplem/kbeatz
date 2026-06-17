import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { LoadingState, EmptyState, ErrorState } from './state-views'

describe('LoadingState', () => {
  it('renders the message inside a polite status region', () => {
    render(<LoadingState message="Loading albums" testId="loading" />)
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toHaveTextContent('Loading albums')
  })
})

describe('EmptyState', () => {
  it('renders the primary message', () => {
    render(<EmptyState message="Nothing here" />)
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
  })

  it('renders the optional hint and action', () => {
    render(
      <EmptyState
        message="Empty"
        hint="Try a scan"
        action={<button type="button">Do thing</button>}
      />,
    )
    expect(screen.getByText('Try a scan')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Do thing' })).toBeInTheDocument()
  })
})

describe('ErrorState', () => {
  it('renders the message inside an assertive alert', () => {
    render(<ErrorState message="It broke" />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('It broke')
  })

  it('does not render a retry button without a handler', () => {
    render(<ErrorState message="It broke" />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders a retry button and invokes the handler on click', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<ErrorState message="It broke" onRetry={onRetry} retryLabel="Retry" />)
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
