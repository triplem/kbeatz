import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { NavDrawer } from './nav-drawer'

function stubMatchMedia(): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: false,
      media: '',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  )
}

function renderDrawer(props: { mobileOpen?: boolean; onClose?: () => void } = {}) {
  const onClose = props.onClose ?? vi.fn()
  return {
    onClose,
    ...render(
      <MemoryRouter>
        <NavDrawer
          width={240}
          mobileOpen={props.mobileOpen ?? false}
          onClose={onClose}
          mobileDrawerId="test-drawer"
        />
      </MemoryRouter>,
    ),
  }
}

describe('NavDrawer', () => {
  beforeEach(() => {
    stubMatchMedia()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not render the temporary overlay drawer when closed', () => {
    renderDrawer({ mobileOpen: false })
    // The temporary Drawer uses a Modal; when closed it is not in the DOM.
    expect(screen.queryByRole('presentation')).not.toBeInTheDocument()
  })

  it('renders the temporary overlay drawer (modal) when mobileOpen is true', () => {
    renderDrawer({ mobileOpen: true })
    expect(screen.getByRole('presentation')).toBeInTheDocument()
  })

  it('renders the nav links (Albums, Library, Settings) inside the temporary drawer when open', () => {
    renderDrawer({ mobileOpen: true })
    const presentation = screen.getByRole('presentation')
    const labels = ['Albums', 'Library', 'Settings']
    for (const label of labels) {
      expect(within(presentation).getByRole('link', { name: label })).toBeInTheDocument()
    }
  })

  it('calls onClose when a destination is tapped in the temporary drawer', async () => {
    const user = userEvent.setup()
    const { onClose } = renderDrawer({ mobileOpen: true })
    const presentation = screen.getByRole('presentation')
    const link = within(presentation).getAllByRole('link', { name: 'Settings' })[0]
    await user.click(link as HTMLElement)
    expect(onClose).toHaveBeenCalled()
  })
})
