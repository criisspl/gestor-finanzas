import { loadEnv, type Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * Política de contenido del build: los datos ya descifrados viven en la página, así que un script
 * ajeno podría leerlos. Solo se permite código y fuentes propios, y conexiones https (cada persona elige
 * su propio proyecto de Supabase en la pantalla de instalación, así que el destino no se conoce al compilar).
 * En desarrollo no se aplica (Vite necesita scripts en línea y websocket).
 */
function csp(supabaseUrl: string | undefined): Plugin {
  // Origen de las variables del despliegue (puede ser http en local); las direcciones de la persona son siempre https
  const origen = supabaseUrl?.match(/^https?:\/\/[^/]+/)?.[0]
  const politica = [
    "default-src 'self'",
    "script-src 'self'",
    // React usa atributos style en línea
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    origen ? `connect-src 'self' https: ${origen}` : "connect-src 'self' https:",
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
    // Los tests de componentes (*.tsx) declaran `// @vitest-environment jsdom`; los de lógica corren en node
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/main.tsx', 'src/vite-env.d.ts'],
      reporter: ['text'],
      // Umbral suave: por debajo del estado actual, solo para que no se desplome
      thresholds: { statements: 30, lines: 30 },
    },
  },
}))
