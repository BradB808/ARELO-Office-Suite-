import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

/**
 * The Content-Security-Policy in index.html has to stay loose enough for the
 * Vite dev server (module graph over HTTP, HMR over a WebSocket). Shipping
 * that policy would leave `ws:` open to any host, which is a ready-made
 * exfiltration channel — so the production build gets a tightened policy
 * swapped in here, with the dev allowances removed.
 *
 * `connect-src` keeps openrouter.ai because the optional AI features call it
 * directly from the renderer. It is a ceiling, not a promise: the main process
 * blocks that host too until a key is stored (electron/security.cjs).
 */
const PRODUCTION_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  "connect-src 'self' https://openrouter.ai",
  "worker-src 'self' blob:",
  // Nothing may be framed, embedded, or submitted anywhere.
  "frame-src 'none'",
  "child-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

function strictCspForBuild(): Plugin {
  return {
    name: 'anleo-strict-csp',
    apply: 'build',
    transformIndexHtml(html) {
      const replaced = html.replace(
        /(<meta\s+http-equiv="Content-Security-Policy"\s+content=")[^"]*(")/i,
        `$1${PRODUCTION_CSP}$2`,
      )
      if (replaced === html) {
        throw new Error(
          'Could not find the CSP meta tag in index.html — refusing to ship without one.',
        )
      }
      return replaced
    },
  }
}

export default defineConfig({
  plugins: [react(), strictCspForBuild()],
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 4000,
  },
})
