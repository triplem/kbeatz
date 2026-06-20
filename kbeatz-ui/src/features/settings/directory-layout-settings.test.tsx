import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppThemeProvider } from '../../theme'
import type { Album, LayoutPreview, LayoutSettings } from '../../api/generated'

vi.mock('../../api/generated', () => ({
  SettingsService: {
    getLayoutSettings: vi.fn(),
    getLayoutPreview: vi.fn(),
  },
  AlbumsService: {
    listAlbums: vi.fn(),
  },
}))

import { SettingsService, AlbumsService } from '../../api/generated'
import { DirectoryLayoutSettings } from './directory-layout-settings'

const mockGetSettings = vi.mocked(SettingsService.getLayoutSettings)
const mockGetPreview = vi.mocked(SettingsService.getLayoutPreview)
const mockListAlbums = vi.mocked(AlbumsService.listAlbums)

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

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <AppThemeProvider>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </AppThemeProvider>
  )
}

const SETTINGS: LayoutSettings = {
  directoryTemplate: '${ALBUMARTIST}/${ALBUM} (${DATE})',
  supportedTokens: ['ALBUM', 'ALBUMARTIST', 'DATE'],
}

function makeAlbum(id: string, albumArtist: string, album: string): Album {
  return { id, albumArtist, album, hasCoverArt: false, albumPath: `/m/${id}` }
}

const ALBUMS = [makeAlbum('a-1', 'Miles Davis', 'Kind of Blue')]

function albumsPage(content: Album[] = ALBUMS) {
  return { content, page: 0, size: 100, totalElements: content.length, totalPages: 1 }
}

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  stubMatchMedia()
  mockGetSettings.mockResolvedValue(SETTINGS)
  mockListAlbums.mockResolvedValue(albumsPage())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('DirectoryLayoutSettings', () => {
  it('renders the active template and supported tokens once loaded', async () => {
    render(<DirectoryLayoutSettings />, { wrapper })

    expect(await screen.findByTestId('layout-template')).toHaveTextContent('${ALBUMARTIST}/${ALBUM} (${DATE})')
    const tokens = await screen.findAllByTestId('layout-token')
    expect(tokens.map((c) => c.textContent)).toEqual(['ALBUM', 'ALBUMARTIST', 'DATE'])
  })

  it('shows the select prompt before an album is chosen', async () => {
    render(<DirectoryLayoutSettings />, { wrapper })
    expect(await screen.findByTestId('layout-preview-empty')).toBeInTheDocument()
    expect(mockGetPreview).not.toHaveBeenCalled()
  })

  it('shows current and planned directory when an album is selected', async () => {
    const preview: LayoutPreview = {
      albumId: 'a-1',
      currentDirectory: 'incoming/kob',
      plannedDirectory: 'Miles Davis/Kind of Blue (1959)',
      withinLibraryRoot: true,
    }
    mockGetPreview.mockResolvedValue(preview)

    const user = userEvent.setup()
    render(<DirectoryLayoutSettings />, { wrapper })

    await screen.findByTestId('layout-template')
    await user.click(screen.getByRole('combobox', { name: 'Preview album' }))
    await user.click(await screen.findByRole('option', { name: 'Miles Davis - Kind of Blue' }))

    const result = await screen.findByTestId('layout-preview-result')
    expect(within(result).getByText('incoming/kob')).toBeInTheDocument()
    expect(within(result).getByText('Miles Davis/Kind of Blue (1959)')).toBeInTheDocument()
    expect(mockGetPreview).toHaveBeenCalledWith({ albumId: 'a-1' })
  })

  it('shows an already-in-place notice when planned equals current', async () => {
    mockGetPreview.mockResolvedValue({
      albumId: 'a-1',
      currentDirectory: 'Miles Davis/Kind of Blue (1959)',
      plannedDirectory: 'Miles Davis/Kind of Blue (1959)',
      withinLibraryRoot: true,
    })

    const user = userEvent.setup()
    render(<DirectoryLayoutSettings />, { wrapper })

    await screen.findByTestId('layout-template')
    await user.click(screen.getByRole('combobox', { name: 'Preview album' }))
    await user.click(await screen.findByRole('option', { name: 'Miles Davis - Kind of Blue' }))

    expect(await screen.findByTestId('layout-preview-in-place')).toBeInTheDocument()
  })

  it('shows a conflict alert when the planner rejects the album', async () => {
    mockGetPreview.mockResolvedValue({
      albumId: 'a-1',
      currentDirectory: 'incoming/kob',
      plannedDirectory: null,
      withinLibraryRoot: false,
      message: 'Planned directory would escape the library root',
    })

    const user = userEvent.setup()
    render(<DirectoryLayoutSettings />, { wrapper })

    await screen.findByTestId('layout-template')
    await user.click(screen.getByRole('combobox', { name: 'Preview album' }))
    await user.click(await screen.findByRole('option', { name: 'Miles Davis - Kind of Blue' }))

    const conflict = await screen.findByTestId('layout-preview-conflict')
    expect(conflict).toHaveTextContent('Planned directory would escape the library root')
  })

  it('shows an error alert when the preview request fails', async () => {
    mockGetPreview.mockRejectedValue(new Error('boom'))

    const user = userEvent.setup()
    render(<DirectoryLayoutSettings />, { wrapper })

    await screen.findByTestId('layout-template')
    await user.click(screen.getByRole('combobox', { name: 'Preview album' }))
    await user.click(await screen.findByRole('option', { name: 'Miles Davis - Kind of Blue' }))

    expect(await screen.findByTestId('layout-preview-error')).toBeInTheDocument()
  })

  it('shows a settings error alert when the template fails to load', async () => {
    mockGetSettings.mockRejectedValue(new Error('nope'))
    render(<DirectoryLayoutSettings />, { wrapper })
    await waitFor(() => {
      expect(screen.getByText('Could not load the directory-layout template.')).toBeInTheDocument()
    })
  })
})
