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

// Use a relative base so API calls are proxied through nginx on any host.
// This makes the UI work from LAN devices without a rebuild.
OpenAPI.BASE = '/api/v1'

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
