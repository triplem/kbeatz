import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './lib/i18n'
import { App } from './App'
import { OpenAPI } from './api/generated'

// Use a relative base so API calls are proxied through nginx on any host.
// This makes the UI work from LAN devices without a rebuild.
OpenAPI.BASE = '/api/v1'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element not found')

createRoot(rootEl).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
