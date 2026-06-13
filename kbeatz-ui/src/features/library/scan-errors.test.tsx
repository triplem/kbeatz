import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { I18nextProvider } from 'react-i18next'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import type { ScanErrorEntry } from '../../api/generated'
import { ScanErrors } from './scan-errors'

// Minimal i18next setup for tests
const testI18n = i18n.createInstance()
void testI18n.use(initReactI18next).init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        scanErrors: {
          summary_one: '{{count}} album could not be scanned - check file permissions or FLAC integrity',
          summary_other: '{{count}} albums could not be scanned - check file permissions or FLAC integrity',
          showDetails: 'Show details',
          hideDetails: 'Hide details',
          andMore: '...and {{count}} more',
          dismiss: 'Dismiss',
          entrySuggestion: 'Suggestion: {{suggestion}}',
        },
      },
    },
  },
})

function makeEntry(albumDir: string, overrides: Partial<ScanErrorEntry> = {}): ScanErrorEntry {
  return {
    albumDir,
    reason: 'Album could not be indexed',
    suggestion: 'Check file permissions or FLAC integrity',
    ...overrides,
  }
}

function renderErrors(errors: ScanErrorEntry[], totalErrors: number, onDismiss?: () => void) {
  return render(
    <I18nextProvider i18n={testI18n}>
      <ScanErrors errors={errors} totalErrors={totalErrors} onDismiss={onDismiss} />
    </I18nextProvider>,
  )
}

describe('ScanErrors', () => {
  it('renders nothing when totalErrors is zero', () => {
    const { container } = renderErrors([], 0)
    expect(container.firstChild).toBeNull()
  })

  it('renders an alert banner when there is one error', () => {
    renderErrors([makeEntry('Miles Davis/Kind of Blue')], 1)
    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveTextContent('1 album could not be scanned')
  })

  it('renders plural summary when there are multiple errors', () => {
    const entries = [
      makeEntry('Artist1/Album1'),
      makeEntry('Artist2/Album2'),
      makeEntry('Artist3/Album3'),
    ]
    renderErrors(entries, 3)
    expect(screen.getByRole('alert')).toHaveTextContent('3 albums could not be scanned')
  })

  it('does not show error entries before expanding', () => {
    renderErrors([makeEntry('Miles Davis/Kind of Blue')], 1)
    expect(screen.queryByText('Miles Davis/Kind of Blue')).not.toBeInTheDocument()
  })

  it('shows error entries after clicking Show details', async () => {
    const user = userEvent.setup()
    renderErrors([makeEntry('Miles Davis/Kind of Blue')], 1)
    await user.click(screen.getByRole('button', { name: 'Show details' }))
    expect(screen.getByText('Miles Davis/Kind of Blue')).toBeInTheDocument()
  })

  it('hides error entries after clicking Hide details', async () => {
    const user = userEvent.setup()
    renderErrors([makeEntry('Miles Davis/Kind of Blue')], 1)
    await user.click(screen.getByRole('button', { name: 'Show details' }))
    await user.click(screen.getByRole('button', { name: 'Hide details' }))
    expect(screen.queryByText('Miles Davis/Kind of Blue')).not.toBeInTheDocument()
  })

  it('shows all 50 entries when totalErrors equals 50', async () => {
    const user = userEvent.setup()
    const entries = Array.from({ length: 50 }, (_, i) => makeEntry(`Artist${i}/Album${i}`))
    renderErrors(entries, 50)
    await user.click(screen.getByRole('button', { name: 'Show details' }))
    expect(screen.queryByText(/and \d+ more/)).not.toBeInTheDocument()
    expect(screen.getByText('Artist0/Album0')).toBeInTheDocument()
    expect(screen.getByText('Artist49/Album49')).toBeInTheDocument()
  })

  it('shows "and N more" when totalErrors is 51 and errors list has 50 entries', async () => {
    const user = userEvent.setup()
    const entries = Array.from({ length: 50 }, (_, i) => makeEntry(`Artist${i}/Album${i}`))
    renderErrors(entries, 51)
    await user.click(screen.getByRole('button', { name: 'Show details' }))
    expect(screen.getByText('...and 1 more')).toBeInTheDocument()
  })

  it('shows each entry suggestion in expanded view', async () => {
    const user = userEvent.setup()
    const entry = makeEntry('Artist/Album', { suggestion: 'Check file permissions' })
    renderErrors([entry], 1)
    await user.click(screen.getByRole('button', { name: 'Show details' }))
    expect(screen.getByText('Suggestion: Check file permissions')).toBeInTheDocument()
  })

  it('hides banner when dismissed', async () => {
    const user = userEvent.setup()
    const { container } = renderErrors([makeEntry('Artist/Album')], 1)
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(container.firstChild).toBeNull()
  })

  it('calls onDismiss callback when dismissed', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    renderErrors([makeEntry('Artist/Album')], 1, onDismiss)
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
