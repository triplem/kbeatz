import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { usePageParams, type PageParams } from './usePageParams'
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_STORAGE_KEY } from './pagination'

function renderParams(initialEntries: string[] = ['/']) {
  const captured: { current: PageParams | null } = { current: null }
  function Harness() {
    captured.current = usePageParams()
    return <output data-testid="p">{`${captured.current.page}/${captured.current.pageSize}`}</output>
  }
  const router = createMemoryRouter([{ path: '*', element: <Harness /> }], { initialEntries })
  render(<RouterProvider router={router} />)
  return captured
}

beforeEach(() => {
  localStorage.clear()
})

describe('usePageParams', () => {
  it('defaults to page 1 and the persisted/default size when no params', () => {
    const c = renderParams()
    expect(c.current?.page).toBe(1)
    expect(c.current?.pageSize).toBe(DEFAULT_PAGE_SIZE)
  })

  it('reads the page and size from the URL', () => {
    renderParams(['/?page=4&size=24'])
    expect(screen.getByTestId('p')).toHaveTextContent('4/24')
  })

  it('lower-bounds an out-of-range or non-numeric page at 1 (no upper clamp)', () => {
    expect(renderParams(['/?page=0']).current?.page).toBe(1)
    expect(renderParams(['/?page=abc']).current?.page).toBe(1)
    // No total here, so a very high page is NOT clamped down (the pager does that).
    expect(renderParams(['/?page=9999']).current?.page).toBe(9999)
  })

  it('prefers the URL size over the persisted default', () => {
    localStorage.setItem(PAGE_SIZE_STORAGE_KEY, '96')
    expect(renderParams(['/?size=24']).current?.pageSize).toBe(24)
    expect(renderParams().current?.pageSize).toBe(96)
  })
})
