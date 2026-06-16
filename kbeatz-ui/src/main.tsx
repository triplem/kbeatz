import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './styles/tokens.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './lib/i18n'
import { AppLayout, AlbumListPage } from './App'
import { AlbumDetail } from './features/albums/album-detail'
import { NotFoundPage } from './features/not-found/not-found-page'
import { ErrorBoundary } from './lib/error-boundary'
import { OpenAPI } from './api/generated'

// Allow runtime override via VITE_API_BASE_URL for LAN deployments where the UI
// is served from a different host or port than the catalog backend.
// Falls back to a relative path so the Vite dev proxy (and nginx reverse-proxy
// deployments) work without any extra configuration.
OpenAPI.BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

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
    element: <AppLayout />,
    children: [
      { index: true, element: <AlbumListPage /> },
      {
        path: '/albums/:albumId',
        element: (
          <ErrorBoundary>
            <AlbumDetail />
          </ErrorBoundary>
        ),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element not found')

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <RouterProvider router={router} />
      </ErrorBoundary>
    </QueryClientProvider>
  </StrictMode>,
)
