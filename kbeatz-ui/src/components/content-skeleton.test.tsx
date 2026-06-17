import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ContentSkeleton } from './content-skeleton'

describe('ContentSkeleton', () => {
  it('exposes an accessible busy status with the supplied label', () => {
    render(<ContentSkeleton ariaLabel="Loading content" testId="skel" />)
    const status = screen.getByRole('status', { name: 'Loading content' })
    expect(status).toHaveAttribute('aria-busy', 'true')
  })

  it('renders the requested number of placeholder lines', () => {
    render(<ContentSkeleton ariaLabel="Loading" lines={5} testId="skel" />)
    const skeletons = screen.getByTestId('skel').querySelectorAll('.MuiSkeleton-root')
    expect(skeletons).toHaveLength(5)
  })

  it('renders at least one line when given a non-positive count', () => {
    render(<ContentSkeleton ariaLabel="Loading" lines={0} testId="skel" />)
    const skeletons = screen.getByTestId('skel').querySelectorAll('.MuiSkeleton-root')
    expect(skeletons).toHaveLength(1)
  })
})
