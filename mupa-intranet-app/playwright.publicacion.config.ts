import { defineConfig, devices } from '@playwright/test'

/**
 * Pruebas de punta a punta de la EDICIÓN PUBLICACIÓN (lib/edicion.ts): web y API
 * arrancadas con esa edición, en puertos propios (no reutiliza servidores que ya
 * estén corriendo, que pueden ser de otra edición o de otra base).
 *  - `npm run test:e2e:publicacion`       contra `vite` (desarrollo).
 *  - `PW_DIST=1 npm run test:e2e:publicacion`  contra dist/ compilado, con la CSP de nginx.
 */
const DIST = !!process.env.PW_DIST
const API = 3101
const WEB = 5181
const BASE = `http://localhost:${WEB}`

export default defineConfig({
  testDir: './tests/e2e-publicacion',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 90_000,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-publicacion' }]],
  use: {
    baseURL: BASE,
    storageState: { cookies: [], origins: [{ origin: BASE, localStorage: [{ name: 'mupa_recorrido', value: '"pruebas"' }] }] },
    locale: 'es-PA',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: process.env.PW_CHANNEL || 'chrome', viewport: { width: 1440, height: 900 } } }],
  webServer: [
    {
      command: 'npm run e2e:serve --prefix ../mupa-intranet-api',
      url: `http://localhost:${API}/api/health`,
      // Como en el servidor: RRHH Express en mantenimiento (el .env.e2e lo apaga para la suite completa).
      env: { PORT: String(API), EDICION: 'publicacion', RRHH_MANTENIMIENTO: 'true' },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: DIST ? `npm run build && npx vite preview --port ${WEB} --strictPort` : `npx vite --port ${WEB} --strictPort`,
      url: BASE,
      env: { API_URL: `http://localhost:${API}`, VITE_EDICION: 'publicacion' },
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
})
