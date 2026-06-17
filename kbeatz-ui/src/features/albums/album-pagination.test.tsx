import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { AppThemeProvider } from '../../theme'
import { AlbumPagination } from './album-pagination'

function renderPagination(props: { page: number; totalPages: number; onPageChange?: (p: number) => void }) {
  const onPageChange = props.onPageChange ?? vi.fn()
  render(
    <AppThemeProvider>
      <AlbumPagination page={props.page} totalPages={props.totalPages} onPageChange={onPageChange} />
    </AppThemeProvider>,
  )
  return { onPageChange }
}

describe('AlbumPagination', () => {
  it('renders nothing when there is a single page', () => {
    renderPagination({ page: 1, totalPages: 1 })
    expect(screen.queryByTestId('album-pagination')).not.toBeInTheDocument()
  })

  it('renders a labelled nav landmark with a live page indicator', () => {
    renderPagination({ page: 2, totalPages: 5 })
    expect(screen.getByRole('navigation', { name: 'Album page navigation' })).toBeInTheDocument()
    const info = screen.getByTestId('pagination-info')
    expect(info).toHaveTextContent('Page 2 of 5')
    expect(info).toHaveAttribute('aria-live', 'polite')
  })

  it('calls onPageChange when a page button is activated by keyboard', async () => {
    const user = userEvent.setup()
    const { onPageChange } = renderPagination({ page: 1, totalPages: 5 })
    const goToPage3 = screen.getByRole('button', { name: 'Go to page 3' })
    goToPage3.focus()
    await user.keyboard('{Enter}')
    expect(onPageChange).toHaveBeenCalledWith(3)
  })

  it('labels the current page distinctly from other pages', () => {
    renderPagination({ page: 3, totalPages: 5 })
    expect(screen.getByRole('button', { name: 'Page 3, current page' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Go to page 4' })).toBeInTheDocument()
  })
})
