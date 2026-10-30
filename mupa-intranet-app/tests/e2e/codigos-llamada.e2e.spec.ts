/**
 * Solicitudes de código de llamada en Mis solicitudes. El backend de pruebas no tiene ese sistema: la respuesta de
 * /api/call-codes/requests se simula con page.route (solicitudes ficticias).
 */
import { expect, test } from '@playwright/test'

import { entrar, vigilarErrores } from './ayuda'

const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })
const solicitud = (number: number, statusId: number, status: string, extra: Record<string, unknown> = {}) => ({
  number, statusId, status, createdAt: '2026-09-15T10:32:00', updatedAt: '2026-09-17T14:05:00', location: 'Dirección Ficticia', lineType: 'LOCALES', extension: '4521', rejectionReason: null,
  history: [{ action: 'CREATE', date: '2026-09-15T10:32:00' }], ...extra,
})
const respuesta = (requests: unknown[]) => json({ available: true, knownCedula: true, total: requests.length, requests })

test('con sesión muestra las solicitudes de código de llamada con su estado y el filtro Abiertas/Cerradas', async ({ page }) => {
  const errores = vigilarErrores(page)
  await page.route('**/api/call-codes/requests', (r) =>
    r.fulfill(
      respuesta([
        solicitud(125, 6, 'Procesado', { lineType: 'NACIONAL LDN', history: [{ action: 'CREATE', date: '2026-09-15T10:32:00' }, { action: 'PROCESS', date: '2026-09-17T14:05:00' }] }),
        solicitud(130, 2, 'Pendiente de Aprobación por Tecnología'),
        solicitud(98, 5, 'Rechazado', { rejectionReason: 'Falta autorización del jefe inmediato.' }),
      ]),
    ),
  )
  await entrar(page, 'prueba1')
  await page.goto('/mis-solicitudes')
  const filas = page.locator('.sol-item--codigo')
  await expect(filas).toHaveCount(3)
  await expect(filas.filter({ hasText: 'N.º 130' })).toContainText('Pendiente de Aprobación por Tecnología')
  await expect(filas.filter({ hasText: 'N.º 125' })).toContainText('Línea NACIONAL LDN · ext. 4521')

  // Cerrada y rechazada: al abrirla se ve el motivo.
  await filas.filter({ hasText: 'N.º 98' }).locator('summary').click()
  await expect(filas.filter({ hasText: 'N.º 98' })).toContainText('Falta autorización del jefe inmediato.')
  // Procesada: su historial en español, y nunca un código.
  await filas.filter({ hasText: 'N.º 125' }).locator('summary').click()
  await expect(filas.filter({ hasText: 'N.º 125' })).toContainText('Procesada: se generó el código')
  await expect(filas.filter({ hasText: 'N.º 125' })).toContainText('el código no se muestra')

  await page.getByRole('button', { name: /Abiertas/ }).click()
  await expect(page.locator('.sol-item--codigo')).toHaveCount(1)
  await page.getByRole('button', { name: /Cerradas/ }).click()
  await expect(page.locator('.sol-item--codigo')).toHaveCount(2)
  expect(errores()).toEqual([])
})

test('sin conexión con el sistema, o sin cédula, Mis solicitudes no cambia: sin solicitudes de código y sin avisos', async ({ page }) => {
  await page.route('**/api/call-codes/requests', (r) => r.fulfill(json({ available: false, knownCedula: false, total: 0, requests: [] })))
  await entrar(page, 'prueba1')
  await page.goto('/mis-solicitudes')
  await expect(page.locator('.sol-item--codigo')).toHaveCount(0)
  await expect(page.locator('.notice--warn')).toHaveCount(0)
})

test('si el sistema falla, lo dice sin tapar el resto de Mis solicitudes', async ({ page }) => {
  await page.route('**/api/call-codes/requests', (r) => r.fulfill(json({ error: 'CALLCODE_UNAVAILABLE', message: 'El sistema de códigos de llamada no responde. Intenta de nuevo en unos minutos.' }, 503)))
  await entrar(page, 'prueba1')
  await page.goto('/mis-solicitudes')
  await expect(page.locator('.notice--warn')).toContainText('códigos de llamada no responde')
})
