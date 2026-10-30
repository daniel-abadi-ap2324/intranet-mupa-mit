/**
 * El asistente también manda a páginas de la intranet (no solo a aplicaciones): se ven como
 * enlaces y la persona llega a la página. La respuesta se simula (el backend de pruebas no tiene
 * servidor de inferencia); qué páginas conoce el asistente se prueba en la API.
 */
import { expect, test } from '@playwright/test'

test('el asistente muestra las páginas de la intranet como enlaces', async ({ page }) => {
  await page.route('**/api/assistant/status', (r) => r.fulfill({ json: { available: true } }))
  await page.route('**/api/assistant/ask', (r) =>
    r.fulfill({
      json: {
        answer: 'Tus marcaciones están en Recursos Humanos, después de conectar tu cuenta de RRHH Express.',
        applications: [],
        pages: [{ path: '/recursos-humanos?seccion=marcaciones', title: 'Mis marcaciones' }],
      },
    }),
  )
  await page.goto('/asistente')
  await page.getByLabel('Tu pregunta para el asistente').fill('quiero ver mis marcaciones')
  await page.getByRole('button', { name: 'Preguntar' }).click()
  const paginas = page.getByRole('log').getByRole('list', { name: 'Páginas de la intranet' })
  await expect(paginas.getByRole('link', { name: 'Mis marcaciones' })).toHaveAttribute('href', '/recursos-humanos?seccion=marcaciones')
  await paginas.getByRole('link', { name: 'Mis marcaciones' }).click()
  await expect(page).toHaveURL(/\/recursos-humanos\?seccion=marcaciones$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Recursos Humanos' })).toBeVisible()
})
