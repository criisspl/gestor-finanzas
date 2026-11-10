import { loadEnv, type Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * Política de contenido del build: los datos ya descifrados viven en la página, así que un script
 * ajeno podría leerlos. Solo se permite código y fuentes propios, y conexiones a Supabase.
 * En desarrollo no se aplica (Vite necesita scripts en línea y websocket).
 */
function csp(supabaseUrl: string | undefined): Plugin {
  // Origen de Supabase (esquema + host); sin variables la app va en modo demo y no se conecta a nada
  const origen = supabaseUrl?.match(/^https?:\/\/[^/]+/)?.[0]
  const politica = [
    "default-src 'self'",
    "script-src 'self'",
    // React usa atributos style en línea
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    origen ? `connect-src 'self' ${origen}` : "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join('; ')
  return {
    name: 'gestor-csp',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: politica }, injectTo: 'head-prepend' },
    ],
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), csp(loadEnv(mode, '.', 'VITE_').VITE_SUPABASE_URL)],
  test: {
    include: ['src/**/*.test.ts'],
  },
}))
