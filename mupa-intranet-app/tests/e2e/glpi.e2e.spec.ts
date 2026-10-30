/**
 * Tickets de la Mesa de Ayuda (GLPI) en Mis solicitudes. El backend de pruebas no tiene GLPI: la respuesta de
 * /api/glpi/tickets se simula con page.route (tickets ficticios).
 */
import { expect, test } from '@playwright/test'

import { entrar, vigilarErrores } from './ayuda'

const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })
const ticket = (id: number, status: number) => ({ id, title: `Soporte – Dirección Ficticia (${id})`, status, openedAt: '2026-10-01 09:30:00', updatedAt: '2026-10-02 11:05:00' })
const respuesta = (tickets: unknown[], userFound = true) => json({ available: true, knownCedula: true, userFound, total: tickets.length, tickets })

test('con su cédula en GLPI muestra sus tickets con su estado, el filtro Abiertas/Cerradas y la aclaración', async ({ page }) => {
  const errores = vigilarErrores(page)
  await page.route('**/api/glpi/tickets', (r) => r.fulfill(respuesta([ticket(45510, 2), ticket(45503, 6)])))
  await entrar(page, 'prueba1')
  await page.goto('/mis-solicitudes')
  const filas = page.locator('.sol-item--ticket')
  await expect(filas).toHaveCount(2)
  await expect(filas.filter({ hasText: 'N.º 45510' })).toContainText('En curso (asignado)')
  await expect(filas.filter({ hasText: 'N.º 45503' })).toContainText('Cerrado')
  await expect(page.getByText('campo «Teléfono» de tu usuario de GLPI y figuras como solicitante')).toBeVisible()

  await page.getByRole('button', { name: /Abiertas/ }).click()
  await expect(page.locator('.sol-item--ticket')).toHaveCount(1)
  await page.getByRole('button', { name: /Cerradas/ }).click()
  await expect(page.locator('.sol-item--ticket')).toHaveCount(1)
  expect(errores()).toEqual([])
})

test('si su cédula no está en «Teléfono» de GLPI, lo dice y explica cómo arreglarlo', async ({ page }) => {
  await page.route('**/api/glpi/tickets', (r) => r.fulfill(respuesta([], false)))
  await entrar(page, 'prueba1')
  await page.goto('/mis-solicitudes')
  await expect(page.getByText('no encontramos tu cédula en el campo «Teléfono» de tu usuario de GLPI')).toBeVisible()
  await expect(page.locator('.sol-item--ticket')).toHaveCount(0)
})

test('sin GLPI conectado, o sin cédula, Mis solicitudes no cambia: sin tickets y sin avisos', async ({ page }) => {
  await page.route('**/api/glpi/tickets', (r) => r.fulfill(json({ available: false, knownCedula: false, userFound: false, total: 0, tickets: [] })))
  await entrar(page, 'prueba1')
  await page.goto('/mis-solicitudes')
  await expect(page.locator('.sol-item--ticket')).toHaveCount(0)
  await expect(page.getByText('GLPI')).toHaveCount(0)
})

test('si GLPI falla, lo dice sin tapar el resto de Mis solicitudes', async ({ page }) => {
  await page.route('**/api/glpi/tickets', (r) => r.fulfill(json({ error: 'GLPI_UNAVAILABLE', message: 'La Mesa de Ayuda (GLPI) no responde. Intenta de nuevo en unos minutos.' }, 503)))
  await entrar(page, 'prueba1')
  await page.goto('/mis-solicitudes')
  await expect(page.locator('.notice--warn')).toContainText('Mesa de Ayuda (GLPI) no responde')
})
