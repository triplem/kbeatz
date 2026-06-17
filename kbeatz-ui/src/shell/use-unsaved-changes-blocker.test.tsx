import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useState, type ReactElement } from 'react'
import { createMemoryRouter, Link, RouterProvider, useNavigate } from 'react-router-dom'
import { useUnsavedChangesBlocker } from './use-unsaved-changes-blocker'

// A minimal page that has "unsaved edits" and uses the shared router-aware
// blocker to guard navigation away. Mirrors the album-detail guard concept at
// the shell level so the test exercises the real mechanism, not a mock.
function GuardedEditor(): ReactElement {
  const [dirty, setDirty] = useState(true)
  const navigate = useNavigate()
  const blocker = useUnsavedChangesBlocker(dirty)

  return (
    <div>
      <h1>Editor</h1>
      <button type="button" onClick={() => { setDirty(false) }}>
        Save
      </button>
      <Link to="/other">Go to other</Link>
      <button type="button" onClick={() => { void navigate('/other') }}>
        Programmatic nav
      </button>
      {blocker.state === 'blocked' && (
        <div role="dialog" aria-label="unsaved-guard">
          <p>Discard changes?</p>
          <button type="button" onClick={() => { blocker.reset() }}>
            Stay
          </button>
          <button type="button" onClick={() => { blocker.proceed() }}>
            Leave
          </button>
        </div>
      )}
    </div>
  )
}

function renderGuarded(initialEntries: string[] = ['/']) {
  const router = createMemoryRouter(
    [
      { path: '/', element: <GuardedEditor /> },
      { path: '/other', element: <div data-testid="other-route">Other</div> },
    ],
    { initialEntries },
  )
  return { router, ...render(<RouterProvider router={router} />) }
}

describe('useUnsavedChangesBlocker', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('blocks an in-app link navigation while there are unsaved changes', async () => {
    const user = userEvent.setup()
    const { router } = renderGuarded()
    await user.click(screen.getByRole('link', { name: 'Go to other' }))
    // Navigation is intercepted: dialog shown, still on the editor route.
    expect(screen.getByRole('dialog', { name: 'unsaved-guard' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('blocks programmatic navigation while there are unsaved changes', async () => {
    const user = userEvent.setup()
    const { router } = renderGuarded()
    await user.click(screen.getByRole('button', { name: 'Programmatic nav' }))
    expect(screen.getByRole('dialog', { name: 'unsaved-guard' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('proceeds with navigation when the user confirms leaving', async () => {
    const user = userEvent.setup()
    const { router } = renderGuarded()
    await user.click(screen.getByRole('link', { name: 'Go to other' }))
    await user.click(screen.getByRole('button', { name: 'Leave' }))
    expect(screen.getByTestId('other-route')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/other')
  })

  it('stays on the page when the user cancels leaving', async () => {
    const user = userEvent.setup()
    const { router } = renderGuarded()
    await user.click(screen.getByRole('link', { name: 'Go to other' }))
    await user.click(screen.getByRole('button', { name: 'Stay' }))
    expect(screen.queryByRole('dialog', { name: 'unsaved-guard' })).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('blocks browser back navigation while there are unsaved changes', async () => {
    // Start with history so router.navigate(-1) has somewhere to go back to.
    const { router } = renderGuarded(['/other', '/'])
    await router.navigate(-1)
    // The blocker intercepts the POP navigation: dialog shown, still on editor.
    expect(await screen.findByRole('dialog', { name: 'unsaved-guard' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('allows navigation freely once changes are saved (no longer dirty)', async () => {
    const user = userEvent.setup()
    const { router } = renderGuarded()
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await user.click(screen.getByRole('link', { name: 'Go to other' }))
    expect(router.state.location.pathname).toBe('/other')
    expect(screen.queryByRole('dialog', { name: 'unsaved-guard' })).not.toBeInTheDocument()
  })

  it('registers a beforeunload handler only while dirty', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const user = userEvent.setup()
    renderGuarded()
    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function))
    // Saving clears dirty; the handler must be removed.
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function))
  })
})
