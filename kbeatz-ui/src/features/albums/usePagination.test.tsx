import { render, screen, act } from '@testing-library/react'
import { useState } from 'react'
import { describe, it, expect, beforeEach } from 'vitest'
import { createMemoryRouter, RouterProvider, useSearchParams } from 'react-router-dom'
import { usePagination, type UsePaginationResult } from './usePagination'
import { PAGE_SIZE_STORAGE_KEY } from './pagination'

/**
 * Renders usePagination inside a memory router. The current hook result and the
 * live URL search string are captured into a mutable ref so tests can assert
 * both state and URL round-tripping.
 */
function renderPagination(
  args: { itemCount: number; resetKey: string },
  initialEntries: string[] = ['/'],
) {
  const captured: { current: UsePaginationResult | null; search: string } = {
    current: null,
    search: '',
  }

  function Harness({ itemCount, resetKey }: { itemCount: number; resetKey: string }) {
    const [params] = useSearchParams()
    captured.search = params.toString()
    captured.current = usePagination({ itemCount, resetKey })
    return <output data-testid="page">{captured.current.page}</output>
  }

  const router = createMemoryRouter([{ path: '*', element: <Harness {...args} /> }], {
    initialEntries,
  })
  render(<RouterProvider router={router} />)
  return { captured }
}

beforeEach(() => {
  localStorage.clear()
})

describe('usePagination', () => {
  it('starts on page 1 with the default page size', () => {
    const { captured } = renderPagination({ itemCount: 100, resetKey: 'a' })
    expect(captured.current?.page).toBe(1)
    expect(captured.current?.pageSize).toBe(50)
    expect(captured.current?.totalPages).toBe(2)
  })

  it('reads the page and size from the URL', () => {
    const { captured } = renderPagination({ itemCount: 100, resetKey: 'a' }, ['/?page=2&size=25'])
    expect(captured.current?.pageSize).toBe(25)
    expect(captured.current?.page).toBe(2)
    expect(captured.current?.totalPages).toBe(4)
  })

  it('setPage writes the page to the URL', () => {
    const { captured } = renderPagination({ itemCount: 100, resetKey: 'a' })
    act(() => captured.current?.setPage(2))
    expect(screen.getByTestId('page')).toHaveTextContent('2')
    expect(captured.search).toContain('page=2')
  })

  it('setPage removes the param when navigating back to page 1', () => {
    const { captured } = renderPagination({ itemCount: 100, resetKey: 'a' }, ['/?page=2'])
    act(() => captured.current?.setPage(1))
    expect(captured.search).not.toContain('page=')
  })

  it('setPage clamps above the maximum', () => {
    const { captured } = renderPagination({ itemCount: 100, resetKey: 'a' })
    act(() => captured.current?.setPage(999))
    expect(screen.getByTestId('page')).toHaveTextContent('2')
  })

  it('setPageSize persists to localStorage and resets to page 1', () => {
    const { captured } = renderPagination({ itemCount: 100, resetKey: 'a' }, ['/?page=2'])
    act(() => captured.current?.setPageSize(25))
    expect(localStorage.getItem(PAGE_SIZE_STORAGE_KEY)).toBe('25')
    expect(captured.current?.pageSize).toBe(25)
    expect(captured.search).toContain('size=25')
    expect(captured.search).not.toContain('page=2')
  })

  it('resets to page 1 when the resetKey changes (filter/sort change)', () => {
    let setKey: ((k: string) => void) | null = null

    function Harness() {
      const [key, setLocalKey] = useState('a')
      setKey = setLocalKey
      const [params] = useSearchParams()
      const result = usePagination({ itemCount: 100, resetKey: key })
      return (
        <output data-testid="state">
          {result.page}|{params.get('page') ?? 'none'}
        </output>
      )
    }

    const router = createMemoryRouter([{ path: '*', element: <Harness /> }], {
      initialEntries: ['/?page=2'],
    })
    render(<RouterProvider router={router} />)

    expect(screen.getByTestId('state')).toHaveTextContent('2|2')

    act(() => setKey?.('b'))

    // Changing the active filter/sort resets pagination to page 1 (param dropped).
    expect(screen.getByTestId('state')).toHaveTextContent('1|none')
  })
})
