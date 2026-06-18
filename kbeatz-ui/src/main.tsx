import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import CircularProgress from '@mui/material/CircularProgress'
import Box from '@mui/material/Box'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './lib/i18n'
import { AlbumListPage } from './App'
import { AppShell } from './shell'
import { NotFoundPage } from './features/not-found/not-found-page'
import { ErrorBoundary } from './lib/error-boundary'
import { AppThemeProvider, sanitizePersistedColorScheme } from './theme'
import { OpenAPI } from './api/generated'

// Allow runtime override via VITE_API_BASE_URL for LAN deployments where the UI
// is served from a different host or port than the catalog backend.
// Falls back to a relative path so the Vite dev proxy (and nginx reverse-proxy
// deployments) work without any extra configuration.
OpenAPI.BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

// Lazy-load the heavier secondary routes so the album-list landing route stays
// off the critical path and the entry chunk stays within the size budget.
const AlbumDetail = lazy(() =>
  import('./features/albums/album-detail').then((m) => ({ default: m.AlbumDetail })),
)
const LibraryPage = lazy(() =>
  import('./features/library/library-page').then((m) => ({ default: m.LibraryPage })),
)
const SettingsPage = lazy(() =>
  import('./features/settings/settings-page').then((m) => ({ default: m.SettingsPage })),
)

function RouteFallback() {
  const { t } = useTranslation()
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
      <CircularProgress aria-label={t('common.loading')} />
    </Box>
  )
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
    },
  },
})

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <AlbumListPage /> },
      {
        path: '/albums/:albumId',
        element: (
          <ErrorBoundary>
            <Suspense fallback={<RouteFallback />}>
              <AlbumDetail />
            </Suspense>
          </ErrorBoundary>
        ),
      },
      {
        path: '/library',
        element: (
          <ErrorBoundary>
            <Suspense fallback={<RouteFallback />}>
              <LibraryPage />
            </Suspense>
          </ErrorBoundary>
        ),
      },
      {
        path: '/settings',
        element: (
          <ErrorBoundary>
            <Suspense fallback={<RouteFallback />}>
              <SettingsPage />
            </Suspense>
          </ErrorBoundary>
        ),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

// Remove any corrupt/unknown persisted theme value before the theme provider
// mounts, so MUI's runtime useColorScheme() falls back to the OS preference
// (system) instead of reading the invalid value verbatim. This keeps the React
// runtime consistent with the no-flash bootstrap in index.html, which already
// sanitises the same key. Must run before AppThemeProvider renders.
sanitizePersistedColorScheme()

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element not found')

createRoot(rootEl).render(
  <StrictMode>
    <AppThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <RouterProvider router={router} />
        </ErrorBoundary>
      </QueryClientProvider>
    </AppThemeProvider>
  </StrictMode>,
)
