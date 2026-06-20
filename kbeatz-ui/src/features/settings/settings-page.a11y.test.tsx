import { afterEach, beforeEach, describe, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppThemeProvider } from '../../theme'
import { SettingsPage } from './settings-page'
import { expectNoA11yViolationsInBothThemes } from '../../test/a11y'

vi.mock('../../api/generated', () => ({
  SettingsService: {
    getLayoutSettings: vi.fn().mockResolvedValue({
      directoryTemplate: '${ALBUMARTIST}/${ALBUM} (${DATE})',
      supportedTokens: ['ALBUM', 'ALBUMARTIST', 'DATE'],
    }),
    getLayoutPreview: vi.fn(),
  },
  AlbumsService: {
    listAlbums: vi.fn().mockResolvedValue({ content: [], page: 0, size: 100, totalElements: 0, totalPages: 0 }),
  },
}))

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

describe('SettingsPage accessibility', () => {
  beforeEach(() => {
    window.localStorage.clear()
    stubMatchMedia()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('has no WCAG 2.1 AA violations in light or dark theme', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    await expectNoA11yViolationsInBothThemes(() => (
      <AppThemeProvider>
        <QueryClientProvider client={client}>
          <SettingsPage />
        </QueryClientProvider>
      </AppThemeProvider>
    ))
  })
})
