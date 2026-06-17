import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'crypto'
import { resolve } from 'path'

const CSP_HASH_PLACEHOLDER = '__INLINE_THEME_SCRIPT_HASH__'
// Matches the whole CSP <meta> line so it can be removed in dev.
const CSP_META_RE = /\s*<meta\s+http-equiv="Content-Security-Policy"[\s\S]*?\/>/

/**
 * Production: keep the Content-Security-Policy and replace the SHA-256 hash
 * placeholder with the real hash of the inline no-flash theme script, computed
 * after Vite's HTML transforms (whitespace/minification can change the bytes).
 * A hash-based CSP avoids 'unsafe-inline' for scripts.
 *
 * Development: strip the CSP <meta> entirely. Vite's dev server injects its own
 * inline module scripts (React Refresh preamble, HMR client) that a strict
 * hash-based script-src would block; the dev server is local-trusted, so the
 * production CSP is what matters and is fully verified in `npm run build`.
 */
function cspThemeScriptHash(isBuild: boolean): Plugin {
  return {
    name: 'csp-theme-script-hash',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        if (!isBuild) {
          return html.replace(CSP_META_RE, '')
        }
        // The bootstrap script is the only non-module inline <script>.
        const match = html.match(/<script>([\s\S]*?)<\/script>/)
        if (!match || match[1] === undefined) {
          throw new Error('csp-theme-script-hash: inline bootstrap script not found')
        }
        const hash = createHash('sha256').update(match[1], 'utf8').digest('base64')
        return html.replace(CSP_HASH_PLACEHOLDER, `sha256-${hash}`)
      },
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react(), cspThemeScriptHash(command === 'build')],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    // MUI ships ESM that re-exports from react-transition-group via directory
    // imports which Vite's node resolver does not handle when externalised.
    // Inlining MUI + emotion during tests forces Vite to transform them.
    server: {
      deps: {
        inline: [/@mui\//, /@emotion\//],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/api/generated/**',
        'src/test-setup.ts',
        '**/*.test.{ts,tsx}',
        '**/index.ts',
        'src/main.tsx',
        'src/App.tsx',
      ],
    },
  },
}))
