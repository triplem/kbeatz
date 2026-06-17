import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LibraryPage } from './library-page'

// Stub the scan button so the library page test stays focused on layout and
// does not pull in the scan data/query layer.
vi.mock('./scan-button', () => ({
  ScanButton: () => <button type="button">Scan library</button>,
}))

describe('LibraryPage', () => {
  it('renders the library heading and the scan trigger', () => {
    render(<LibraryPage />)
    expect(screen.getByRole('heading', { name: 'Library', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Scan library' })).toBeInTheDocument()
  })
})
