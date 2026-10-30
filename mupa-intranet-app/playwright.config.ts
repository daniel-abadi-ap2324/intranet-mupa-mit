import { defineConfig, devices } from '@playwright/test'

/**
 * Pruebas de punta a punta de la SPA contra el backend real (../mupa-intranet-api).
 *  - `npm run test:e2e`       contra `npm run dev` (Vite).
 *  - `npm run test:e2e:dist`  contra dist/ compilado (`vite preview`) con las mismas
 *                             cabeceras de seguridad (CSP) que pone nginx.
 *  - PW_BASE_URL=http://localhost:8080 npm run test:e2e
 *                             contra algo ya levantado (por ejemplo `docker compose up`
 *                             con SEED_DEMO_USERS=true); no arranca servidores.
 * Usa el Chrome instalado (channel: 'chrome'); PW_CHANNEL=msedge para Edge.
 */
const DIST = !!process.env.PW_DIST
const PUERTO = DIST ? 4173 : 5173
const EXTERNA = process.env.PW_BASE_URL
const BASE = EXTERNA || `http://localhost:${PUERTO}`

export default defineConfig({
  testDir: './tests/e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Comparten la base del backend: una a la vez.
  workers: 1,
  timeout: 60_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE,
    // El recorrido para usuarios nuevos aparece en la primera visita y taparía las pruebas:
    // todas empiezan con él ya visto (también las páginas de browser.newContext()).
    // recorrido.e2e.spec.ts lo vuelve a activar con test.use({ storageState: vacío }).
    storageState: { cookies: [], origins: [{ origin: new URL(BASE).origin, localStorage: [{ name: 'mupa_recorrido', value: '"pruebas"' }] }] },
    locale: 'es-PA',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chrome',
      use: {
        ...devices['Desktop Chrome'],
        channel: process.env.PW_CHANNEL || 'chrome',
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: EXTERNA
    ? []
    : [
        {
          // Backend real con una base en memoria nueva: datos iniciales + cuentas ficticias.
          command: 'npm run e2e:serve --prefix ../mupa-intranet-api',
          url: 'http://localhost:3000/api/health',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
        {
          command: DIST ? 'npm run build && npm run preview' : 'npm run dev',
          url: `http://localhost:${PUERTO}`,
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
        },
      ],
})
