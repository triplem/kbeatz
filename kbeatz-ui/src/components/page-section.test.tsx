import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PageSection } from './page-section'

describe('PageSection', () => {
  it('renders the title as a heading and shows children', () => {
    render(
      <PageSection title="My Section">
        <p>child content</p>
      </PageSection>,
    )
    expect(screen.getByRole('heading', { name: 'My Section', level: 2 })).toBeInTheDocument()
    expect(screen.getByText('child content')).toBeInTheDocument()
  })

  it('renders the optional description when provided', () => {
    render(
      <PageSection title="Title" description="A helpful description">
        <span />
      </PageSection>,
    )
    expect(screen.getByText('A helpful description')).toBeInTheDocument()
  })

  it('does not render a description paragraph when omitted', () => {
    render(
      <PageSection title="Title" testId="section">
        <span>body</span>
      </PageSection>,
    )
    const section = screen.getByTestId('section')
    // Only the heading should be present, no description text node.
    expect(section.querySelectorAll('p')).toHaveLength(0)
  })

  it('renders the heading at the requested level', () => {
    render(
      <PageSection title="Sub" headingLevel="h3">
        <span />
      </PageSection>,
    )
    expect(screen.getByRole('heading', { name: 'Sub', level: 3 })).toBeInTheDocument()
  })

  it('labels the section landmark with the title by default', () => {
    render(
      <PageSection title="Region">
        <span />
      </PageSection>,
    )
    expect(screen.getByRole('region', { name: 'Region' })).toBeInTheDocument()
  })

  it('labels the section landmark with an explicit ariaLabel when provided', () => {
    render(
      <PageSection title="Region" ariaLabel="Custom label">
        <span />
      </PageSection>,
    )
    expect(screen.getByRole('region', { name: 'Custom label' })).toBeInTheDocument()
  })
})
