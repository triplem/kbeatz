import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { AlbumCreditsSection } from './album-credits-section'

/**
 * AlbumCreditsSection is a pure renderer receiving props.
 * No router or query provider needed.
 * i18n is provided by the global test setup (vitest.setup.ts).
 */

describe('AlbumCreditsSection', () => {
  // ─── Hidden when all credits are absent ───────────────────────────────────

  it('renders nothing when all three fields are undefined', () => {
    const { container } = render(
      <AlbumCreditsSection composer={undefined} conductor={undefined} ensemble={undefined} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when all three fields are null', () => {
    const { container } = render(
      <AlbumCreditsSection composer={null} conductor={null} ensemble={null} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when all three fields are empty strings', () => {
    const { container } = render(
      <AlbumCreditsSection composer="" conductor="" ensemble="" />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('does not render the section when called with no props', () => {
    const { container } = render(<AlbumCreditsSection />)
    expect(container.firstChild).toBeNull()
  })

  // ─── Rendered when at least one field is present ──────────────────────────

  it('renders the credits section when only composer is set', () => {
    render(<AlbumCreditsSection composer="Mozart" />)
    expect(screen.getByTestId('album-credits-section')).toBeInTheDocument()
  })

  it('renders the credits section when only conductor is set', () => {
    render(<AlbumCreditsSection conductor="Rattle" />)
    expect(screen.getByTestId('album-credits-section')).toBeInTheDocument()
  })

  it('renders the credits section when only ensemble is set', () => {
    render(<AlbumCreditsSection ensemble="LSO" />)
    expect(screen.getByTestId('album-credits-section')).toBeInTheDocument()
  })

  it('renders the credits section when all three fields are set', () => {
    render(<AlbumCreditsSection composer="Mozart" conductor="Rattle" ensemble="LSO" />)
    expect(screen.getByTestId('album-credits-section')).toBeInTheDocument()
  })

  // ─── Individual rows ──────────────────────────────────────────────────────

  it('renders Composer row when composer is set', () => {
    render(<AlbumCreditsSection composer="Beethoven" />)
    expect(screen.getByTestId('album-credits-section')).toHaveTextContent('Beethoven')
    expect(screen.getByTestId('album-credits-section')).toHaveTextContent('Composer')
  })

  it('renders Conductor row when conductor is set', () => {
    render(<AlbumCreditsSection conductor="Bernstein" />)
    expect(screen.getByTestId('album-credits-section')).toHaveTextContent('Bernstein')
    expect(screen.getByTestId('album-credits-section')).toHaveTextContent('Conductor')
  })

  it('renders Ensemble row when ensemble is set', () => {
    render(<AlbumCreditsSection ensemble="Berlin Philharmonic" />)
    expect(screen.getByTestId('album-credits-section')).toHaveTextContent('Berlin Philharmonic')
    expect(screen.getByTestId('album-credits-section')).toHaveTextContent('Ensemble')
  })

  // ─── Omits individual rows when absent ────────────────────────────────────

  it('omits Composer row when composer is absent', () => {
    render(<AlbumCreditsSection conductor="Rattle" ensemble="LSO" />)
    // The section is present but no Composer row
    expect(screen.getByTestId('album-credits-section')).toBeInTheDocument()
    expect(screen.queryByTestId('credit-row-composer')).not.toBeInTheDocument()
  })

  it('omits Conductor row when conductor is absent', () => {
    render(<AlbumCreditsSection composer="Mozart" ensemble="LSO" />)
    expect(screen.queryByTestId('credit-row-conductor')).not.toBeInTheDocument()
  })

  it('omits Ensemble row when ensemble is absent', () => {
    render(<AlbumCreditsSection composer="Mozart" conductor="Rattle" />)
    expect(screen.queryByTestId('credit-row-ensemble')).not.toBeInTheDocument()
  })

  it('renders all three rows when all three values are present', () => {
    render(<AlbumCreditsSection composer="Mozart" conductor="Rattle" ensemble="LSO" />)
    expect(screen.getByTestId('credit-row-composer')).toBeInTheDocument()
    expect(screen.getByTestId('credit-row-conductor')).toBeInTheDocument()
    expect(screen.getByTestId('credit-row-ensemble')).toBeInTheDocument()
  })

  // ─── Accessibility: heading and section landmark ──────────────────────────

  it('renders the Credits heading at h2 level', () => {
    render(<AlbumCreditsSection composer="Mozart" />)
    const heading = screen.getByRole('heading', { level: 2, name: 'Credits' })
    expect(heading).toBeInTheDocument()
  })

  it('renders the section as a landmark region accessible by its heading name', () => {
    render(<AlbumCreditsSection composer="Mozart" />)
    // aria-labelledby takes precedence over aria-label; the region name is the h2 text
    const region = screen.getByRole('region', { name: 'Credits' })
    expect(region).toBeInTheDocument()
  })

  it('section is labelled with the Credits heading via aria-labelledby', () => {
    render(<AlbumCreditsSection composer="Mozart" />)
    const section = screen.getByTestId('album-credits-section')
    expect(section).toHaveAttribute('aria-labelledby', 'album-credits-heading')
  })

  it('section has an aria-label of "Album credits"', () => {
    render(<AlbumCreditsSection composer="Mozart" />)
    const section = screen.getByTestId('album-credits-section')
    expect(section).toHaveAttribute('aria-label', 'Album credits')
  })

  // ─── Partial field combinations ───────────────────────────────────────────

  it('renders only the rows that are present when partially filled', () => {
    render(<AlbumCreditsSection composer="Brahms" ensemble="Vienna Phil" />)
    const section = screen.getByTestId('album-credits-section')
    expect(section).toHaveTextContent('Brahms')
    expect(section).toHaveTextContent('Vienna Phil')
    // Conductor row omitted
    expect(screen.queryByTestId('credit-row-conductor')).not.toBeInTheDocument()
    // The two present rows are shown
    expect(screen.getByTestId('credit-row-composer')).toBeInTheDocument()
    expect(screen.getByTestId('credit-row-ensemble')).toBeInTheDocument()
  })
})
