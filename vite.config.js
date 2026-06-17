import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Security headers applied during `vite dev` and `vite preview`.
// Production deployments use public/_headers (Netlify/Cloudflare) or public/.htaccess (Apache).
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'no-referrer-when-downgrade',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "connect-src 'self' https://api.frankfurter.dev",
    "img-src 'self' data: blob:",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
}

export default defineConfig({
  plugins: [react()],
  server: { headers: SECURITY_HEADERS },
  preview: { headers: SECURITY_HEADERS },
  build: {
    // Source maps off by default in Vite — keeping explicit for documentation clarity
    sourcemap: false,
  },
})
