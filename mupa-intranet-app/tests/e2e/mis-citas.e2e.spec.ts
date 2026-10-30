/**
 * «Mis citas» en la página de la Clínica. El backend de pruebas no tiene la API de la Clínica: la respuesta de
 * /api/clinic/appointments se simula con page.route (citas ficticias).
 */
import { expect, test } from '@playwright/test'

import { entrar, vigilarErrores } from './ayuda'

const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })
const cita = (id: string, date: string, status: string, extra: Record<string, unknown> = {}) => ({
  id, date, time: '09:30', type: 'CONSULTA', specialty: 'Medicina general', doctor: 'Dra. Ficticia', status, attended: status === 'ATENDIDA', cancelled: status === 'CANCELADA', ...extra,
})

test('sin sesión invita a entrar y no pide nada a la Clínica', async ({ page }) => {
  let llamadas = 0
  await page.route('**/api/clinic/appointments', (r) => {
    llamadas++
    return r.fulfill(json({}, 401))
  })
  await page.goto('/clinica')
  const seccion = page.locator('section[aria-labelledby="h-mis-citas"]')
  await expect(seccion).toContainText('Inicia sesión')
  expect(llamadas).toBe(0)
})

test('con sesión muestra las próximas y el historial, con su estado', async ({ page }) => {
  const errores = vigilarErrores(page)
  const futuro = new Date(Date.now() + 15 * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'America/Panama' })
  await page.route('**/api/clinic/appointments', (r) =>
    r.fulfill(
      json({
        available: true,
        knownCedula: true,
        patientFound: true,
        total: 3,
        appointments: [cita('1', '2026-03-02', 'ATENDIDA'), cita('2', futuro, 'AGENDADA', { time: '14:05', specialty: 'Odontología' }), cita('3', '2026-04-10', 'CANCELADA')],
      }),
    ),
  )
  await entrar(page, 'prueba1')
  await page.goto('/clinica')
  const seccion = page.locator('section[aria-labelledby="h-mis-citas"]')
  await expect(seccion).toContainText('3 en total')
  const proximas = seccion.locator('.clin-citas').first()
  await expect(proximas.locator('.clin-cita')).toHaveCount(1)
  await expect(proximas).toContainText('2:05 p. m.')
  await expect(proximas).toContainText('Odontología')
  await expect(proximas.locator('.clin-cita__estado')).toHaveText('Agendada')
  const historial = seccion.locator('.clin-citas').nth(1)
  await expect(historial.locator('.clin-cita')).toHaveCount(2)
  await expect(historial).toContainText('Atendida')
  await expect(historial).toContainText('Cancelada')
  expect(errores()).toEqual([])
})

test('quien no es paciente, sin cédula conocida o sin conexión con la Clínica: cada caso lo dice', async ({ page }) => {
  const casos = {
    noPaciente: json({ available: true, knownCedula: true, patientFound: false, total: 0, appointments: [] }),
    sinCedula: json({ available: true, knownCedula: false, patientFound: false, total: 0, appointments: [] }),
    sinConexion: json({ available: false, knownCedula: false, patientFound: false, total: 0, appointments: [] }),
    caida: json({ error: 'CLINIC_UNAVAILABLE', message: 'El sistema de la Clínica no responde. Intenta de nuevo en unos minutos.' }, 503),
  }
  await entrar(page, 'prueba1')
  // La respuesta se fija antes de cada visita: en desarrollo (StrictMode) la página puede pedir las citas más de una vez.
  let actual = casos.noPaciente
  await page.route('**/api/clinic/appointments', (r) => r.fulfill(actual))
  const seccion = page.locator('section[aria-labelledby="h-mis-citas"]')

  await page.goto('/clinica')
  await expect(seccion).toContainText('todavía no tiene un expediente a tu nombre')
  actual = casos.sinCedula
  await page.reload()
  await expect(seccion).toContainText('No sabemos tu cédula en esta sesión')
  actual = casos.sinConexion
  await page.reload()
  await expect(seccion).toContainText('no está incluida en esta copia')
  actual = casos.caida
  await page.reload()
  await expect(seccion.getByRole('alert')).toContainText('no responde')
})

test('las citas de la Clínica también salen en Mis solicitudes y en su bloque del Inicio, con su estado y el filtro Abiertas/Cerradas', async ({ page }) => {
  const errores = vigilarErrores(page)
  const futuro = new Date(Date.now() + 15 * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'America/Panama' })
  await page.route('**/api/clinic/appointments', (r) =>
    r.fulfill(
      json({
        available: true,
        knownCedula: true,
        patientFound: true,
        total: 3,
        appointments: [cita('1', '2026-03-02', 'ATENDIDA'), cita('2', futuro, 'AGENDADA', { time: '14:05', specialty: 'Odontología' }), cita('3', '2026-04-10', 'CANCELADA')],
      }),
    ),
  )
  await entrar(page, 'prueba1')

  await page.goto('/mis-solicitudes')
  const citas = page.locator('.sol-item--cita')
  await expect(citas).toHaveCount(3)
  await expect(citas.filter({ hasText: 'Odontología' })).toContainText('2:05 p. m.')
  await expect(citas.filter({ hasText: 'Odontología' })).toContainText('Agendada')
  await page.getByRole('button', { name: /Abiertas/ }).click()
  await expect(page.locator('.sol-item--cita')).toHaveCount(1)
  await page.getByRole('button', { name: /Cerradas/ }).click()
  await expect(page.locator('.sol-item--cita')).toHaveCount(2)
  await page.locator('.sol-item--cita').first().click()
  await expect(page).toHaveURL(/\/clinica$/)

  // En el Inicio, dentro del bloque «Mis solicitudes».
  await page.goto('/')
  const bloque = page.locator('.home-w[data-uid=solicitudes]')
  await bloque.getByRole('tab', { name: 'Todas' }).click()
  await expect(bloque).toContainText('Cita · Odontología')
  await expect(bloque).toContainText('Cita · Clínica')
  expect(errores()).toEqual([])
})

test('sin conexión con la Clínica, Mis solicitudes no cambia: sin citas y sin avisos', async ({ page }) => {
  await page.route('**/api/clinic/appointments', (r) => r.fulfill(json({ available: false, knownCedula: false, patientFound: false, total: 0, appointments: [] })))
  await entrar(page, 'prueba1')
  await page.goto('/mis-solicitudes')
  await expect(page.locator('.sol-item--cita')).toHaveCount(0)
  await expect(page.getByRole('alert')).toHaveCount(0)
})
