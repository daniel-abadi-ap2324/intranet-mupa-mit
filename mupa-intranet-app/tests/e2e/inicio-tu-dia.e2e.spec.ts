/**
 * «Tu día» y «Mi resumen» en el Inicio. El backend de pruebas no tiene la Clínica, los códigos de llamada, la Mesa de
 * Ayuda ni RH Link: se simulan con page.route (datos ficticios). Las cuentas de prueba no tienen cédula conocida.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

import { entrar, vigilarErrores } from './ayuda'
import { simular } from './simular-inicio'

const tuDia = (page: Page) => page.getByTestId('tu-dia')

test('a 1440 px «Tu día» va en una columna a la derecha, con la fecha larga, y sin sesión invita a entrar', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const errores = vigilarErrores(page)
  await page.goto('/')
  await expect(tuDia(page)).toBeVisible()
  await expect(tuDia(page)).toHaveCount(1)
  await expect(tuDia(page).getByRole('heading', { name: 'Tu día', level: 2 })).toBeVisible()
  await expect(tuDia(page)).toContainText(/(Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo) \d{1,2} de [a-záéíóú]+ de \d{4}/)
  await expect(tuDia(page)).toContainText('Inicia sesión para ver aquí tus solicitudes abiertas y tu próxima cita')
  // La columna queda a la derecha del contenido, fuera de la cuadrícula de bloques.
  const cu = await tuDia(page).boundingBox()
  const grid = await page.locator('#homeGrid').boundingBox()
  expect(cu!.x).toBeGreaterThan(grid!.x + grid!.width - 1)
  expect(await tuDia(page).evaluate((e) => !!e.closest('#home'))).toBe(false)
  await expect(page.locator('[data-widget="resumen"]')).toHaveCount(0)
  expect(errores()).toEqual([])
})

test('con sesión muestra solicitudes abiertas y próxima cita, y consulta cada sistema una vez por visita', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const llamadas = await simular(page)
  await entrar(page, 'prueba1')
  const t = tuDia(page)
  await expect(t.getByRole('heading', { name: 'Solicitudes abiertas' })).toBeVisible()
  await expect(t.locator('.dia__n')).toHaveText('1')
  await expect(t).toContainText('No abre el correo')
  await expect(t).toContainText('Mesa de Ayuda · Ticket N.º 41')
  // La cita más próxima (no la que se agendó primero ni la última de la lista).
  await expect(t.getByRole('heading', { name: 'Próxima cita' })).toBeVisible()
  await expect(t).toContainText('Medicina general')
  await expect(t.getByRole('link', { name: 'Ver mis solicitudes' })).toHaveAttribute('href', '/mis-solicitudes')
  await expect(t.getByRole('heading', { name: 'Gestión' })).toHaveCount(0)
  // Una vez por visita al Inicio, compartida con los bloques (en desarrollo, StrictMode monta dos veces: nunca más que eso).
  for (const n of [llamadas.clinica, llamadas.glpi, llamadas.codigos]) expect(n).toBeLessThanOrEqual(2)
})

test('si una consulta falla lo dice; no se muestra lo que no está conectado', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await simular(page, { clinica: 'apagada', glpi: 'error', codigos: 'error' })
  await entrar(page, 'prueba1')
  const t = tuDia(page)
  await expect(t).toContainText('No se pudo consultar ahora')
  await expect(t).not.toContainText('Nada pendiente')
  await expect(t.getByRole('heading', { name: 'Próxima cita' })).toHaveCount(0)
})

test('«Mi resumen» sale solo con RRHH Express conectado y enlaza a cada pestaña', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const llamadas = await simular(page, { rrhh: true })
  await entrar(page, 'prueba1')
  const r = page.locator('[data-widget="resumen"]')
  await expect(r).toBeVisible()
  await expect(r).toContainText('4 h 30 min')
  await expect(r.getByRole('link', { name: /Tardanzas · / })).toContainText('2')
  await expect(r.getByRole('link', { name: /Tardanzas · / })).toHaveAttribute('href', /seccion=marcaciones/)
  await expect(r.getByRole('link', { name: /Ausencias · / })).toContainText('Sin ausencias')
  await expect(r.getByRole('link', { name: /Último comprobante/ })).toContainText('15 oct 2026')
  await expect(r.getByRole('link', { name: /Último comprobante/ })).toHaveAttribute('href', /seccion=comprobantes/)
  await expect(r.getByRole('link', { name: /Tiempo compensatorio/ })).toHaveAttribute('href', /seccion=compensatorio/)
  expect(llamadas.rrhhDatos).toBe(3)
})

test('sin RRHH Express conectado no hay «Mi resumen», no pide datos y tampoco deja hueco', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const llamadas = await simular(page, { rrhh: false })
  await entrar(page, 'prueba1')
  await expect(tuDia(page)).toBeVisible()
  await expect(page.locator('[data-widget="resumen"]')).toHaveCount(0)
  expect(llamadas.rrhhDatos).toBe(0)
  // El primer bloque sigue pegado al buscador (sin una fila vacía en medio).
  const buscador = await page.locator('[data-widget="buscador"]').boundingBox()
  const primero = await page.locator('#homeGrid > .home-w').nth(1).boundingBox()
  expect(primero!.y - (buscador!.y + buscador!.height)).toBeLessThan(40)
})

test('en Personalizar «Mi resumen» sin conexión dice que la necesita', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await simular(page, { rrhh: false })
  await entrar(page, 'prueba1')
  await page.goto('/?personalizar=1')
  await expect(page.locator('[data-widget="resumen"]')).toHaveCount(0)
  await page.getByRole('button', { name: /Agregar bloque/ }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: /Mi resumen/ }).first().click()
  await expect(page.locator('[data-widget="resumen"]')).toContainText('necesita RRHH Express conectado')
})

test('en el teléfono «Tu día» va dentro del Inicio, una sola vez y sin desplazamiento horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await simular(page, { rrhh: true })
  await entrar(page, 'prueba1')
  await expect(tuDia(page)).toHaveCount(1)
  await expect(tuDia(page)).toHaveClass(/dia--linea/)
  expect(await tuDia(page).evaluate((e) => !!e.closest('#home'))).toBe(true)
  await expect(tuDia(page).locator('.dia__n')).toHaveText('1')
  await expect(page.locator('[data-widget="resumen"]')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  // El saludo sigue siendo el primer bloque: «Tu día» va debajo del buscador.
  const b = await page.locator('[data-widget="buscador"]').boundingBox()
  const t = await tuDia(page).boundingBox()
  expect(t!.y).toBeGreaterThan(b!.y)
})

for (const ancho of [1440, 390]) {
  test(`accesibilidad de «Tu día» y «Mi resumen» a ${ancho} px (axe, WCAG 2.1 AA)`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 900 })
    await simular(page, { rrhh: true })
    await entrar(page, 'prueba1')
    await expect(page.locator('[data-widget="resumen"]')).toBeVisible()
    await expect(tuDia(page).locator('.dia__n')).toHaveText('1')
    const r = await new AxeBuilder({ page }).include('[data-testid="tu-dia"]').include('[data-widget="resumen"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(r.violations.map((v) => v.id + ': ' + v.nodes.map((n) => n.target.join(' ')).join(' | '))).toEqual([])
  })
}

test('quien atiende solicitudes ve la tarjeta Gestión con sus cifras (edición completa)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await simular(page)
  await entrar(page, 'gestor')
  const g = tuDia(page).locator('section', { has: page.getByRole('heading', { name: 'Gestión' }) })
  await expect(g).toBeVisible()
  await expect(g.getByText('Abiertas')).toBeVisible()
  await expect(g.getByText('Atrasadas')).toBeVisible()
  await expect(g.getByText('1.ª respuesta')).toBeVisible()
})
