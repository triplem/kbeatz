import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ErrorBoundary } from './error-boundary'
import { NotFoundPage } from '../features/not-found/not-found-page'

// Suppress React's error boundary console.error output during tests
const originalConsoleError = console.error
beforeEach(() => {
  console.error = vi.fn()
})
afterEach(() => {
  console.error = originalConsoleError
})

function ThrowingComponent(): never {
  throw new Error('Test render error')
}

describe('ErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('All good')).toBeInTheDocument()
  })

  it('renders fallback when a child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>,
    )
    expect(screen.getByTestId('error-boundary-fallback')).toBeInTheDocument()
    expect(screen.getByText('Something went wrong.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('renders custom fallback prop when a child throws', () => {
    render(
      <ErrorBoundary fallback={<p data-testid="custom-fallback">Custom error</p>}>
        <ThrowingComponent />
      </ErrorBoundary>,
    )
    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument()
    expect(screen.queryByTestId('error-boundary-fallback')).not.toBeInTheDocument()
  })

  it('fallback has role=alert for accessibility', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})

describe('NotFoundPage', () => {
  it('shows 404 heading for unknown routes', () => {
    render(
      <MemoryRouter initialEntries={['/some/unknown/path']}>
        <Routes>
          <Route path="/" element={<p>Home</p>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByTestId('not-found-page')).toBeInTheDocument()
    expect(screen.getByText('Page not found')).toBeInTheDocument()
  })

  it('shows a link back to the library root', () => {
    render(
      <MemoryRouter initialEntries={['/oops']}>
        <Routes>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </MemoryRouter>,
    )
    const link = screen.getByRole('link', { name: 'Back to library' })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/')
  })

  it('does not render the 404 page on a known route', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<p>Home page</p>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.queryByTestId('not-found-page')).not.toBeInTheDocument()
    expect(screen.getByText('Home page')).toBeInTheDocument()
  })
})
