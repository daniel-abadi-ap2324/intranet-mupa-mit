/** La caja "¿Qué necesitas hoy?" del Inicio: busca mientras se escribe y le pregunta al asistente. */
import fs from 'node:fs'

import { expect, test, type Page } from '@playwright/test'

import { vigilarErrores } from './ayuda'

type Persona = { nombre: string; apellido: string; direccion: string; ext: string }
const PERSONAS: Persona[] = JSON.parse(fs.readFileSync(new URL('../../src/data/directorio-personas.json', import.meta.url), 'utf8'))

// Una persona del directorio real con un apellido que no se repite.
const persona = PERSONAS.find((p) => p.apellido.length > 4 && PERSONAS.filter((q) => q.apellido === p.apellido).length === 1)!

const caja = (page: Page) => page.getByLabel('¿Qué necesitas hoy?')
const resultados = (page: Page) => page.locator('#inicio-resultados')

/** El servidor de pruebas no tiene asistente: se simula prendido (y su respuesta, si se pasa). */
async function asistentePrendido(page: Page, respuesta?: { answer: string; applications: string[] }) {
  await page.route('**/api/assistant/status', (r) => r.fulfill({ json: { available: true } }))
  if (respuesta) await page.route('**/api/assistant/ask', (r) => r.fulfill({ json: respuesta }))
}

test('busca mientras se escribe y agrupa los resultados; en el Inicio no hay otro buscador', async ({ page }) => {
  const errores = vigilarErrores(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Buenos días|Buenas tardes|Buenas noches/)
  await expect(page.locator('#topbar .app-search')).toHaveCount(0)

  await caja(page).fill('carpetas')
  await expect(resultados(page).getByRole('heading', { name: /Formularios/ })).toBeVisible()
  await expect(resultados(page).getByRole('link', { name: /Carpetas Compartidas/i }).first()).toBeVisible()
  // Los trámites de RRHH se encuentran y llevan a «Cómo solicitar».
  await caja(page).fill('carta de trabajo')
  await expect(resultados(page).getByRole('link', { name: /Recursos Humanos/i }).first()).toHaveAttribute('href', '/recursos-humanos')

  // Personas del directorio.
  await caja(page).fill(persona.apellido)
  await expect(resultados(page).getByRole('heading', { name: /Personas/ })).toBeVisible()
  await expect(resultados(page).getByRole('link', { name: persona.nombre + ' ' + persona.apellido })).toHaveAttribute('href', /\/directorio\?q=/)

  // Flecha abajo: al primer resultado. Escape en la caja: la limpia.
  await caja(page).press('ArrowDown')
  await expect(resultados(page).locator('.home-res__grupo a').first()).toBeFocused()
  await caja(page).focus()
  await caja(page).press('Escape')
  await expect(caja(page)).toHaveValue('')
  await expect(resultados(page)).toBeHidden()
  expect(errores()).toEqual([])
})

test('busca por raíz y por inicio de palabra: plurales, preguntas largas y siglas', async ({ page }) => {
  await page.goto('/')
  await caja(page).fill('cómo pido un código de llamadas')
  await expect(resultados(page).locator('.home-res__grupo a').first()).toContainText('Códigos de llamadas')
  await caja(page).fill('comprobante de pago')
  await expect(resultados(page).getByRole('link', { name: /Recursos Humanos/ }).first()).toBeVisible()
  await caja(page).fill('ARI')
  await expect(resultados(page).locator('.home-res__grupo a').first()).toContainText('ARI')
  await expect(resultados(page).getByText('Ariadna')).toHaveCount(0)
})

test('sin resultados ofrece el asistente, el Directorio y la Mesa de Servicios', async ({ page }) => {
  await asistentePrendido(page)
  await page.goto('/')
  await caja(page).fill('zzqqxx')
  const vacio = resultados(page).locator('.home-res--vacio')
  await expect(vacio).toContainText('No encontramos «zzqqxx»')
  await expect(vacio.getByRole('button', { name: 'Preguntarle al asistente' })).toBeVisible()
  await expect(vacio.getByRole('link', { name: /Directorio/ })).toBeVisible()
  await expect(vacio.getByRole('link', { name: /Mesa de Servicios, ext\. 1400/ })).toBeVisible()
})

test('«Pregúntale al asistente» (en los resultados) lleva a su página con la pregunta, y ahí responde', async ({ page }) => {
  await asistentePrendido(page, { answer: 'Para el correo usa Correo institucional.', applications: ['correo'] })
  await page.goto('/')
  await caja(page).fill('no me funciona el correo')
  await resultados(page).getByRole('button', { name: /asistente/ }).first().click()
  await expect(page).toHaveURL(/\/asistente$/)
  const log = page.getByRole('log')
  await expect(log).toContainText('no me funciona el correo')
  await expect(log).toContainText('Para el correo usa Correo institucional.')
  await expect(log.locator('.app-tile').first()).toBeVisible()
})

test('el saludo es corto (sin sugerencias ni atajos) y sin asistente disponible no se ofrece preguntarle', async ({ page }) => {
  await page.goto('/')
  await expect(caja(page)).toBeVisible()
  await expect(page.locator('.home-search__chip, .hero__atajos')).toHaveCount(0)
  await caja(page).fill('correo')
  await expect(resultados(page).locator('.home-res__grupo').first()).toBeVisible()
  await expect(resultados(page).getByRole('button', { name: /asistente/ })).toHaveCount(0)
})

test('Ctrl+K enfoca la caja del Inicio', async ({ page }) => {
  await page.goto('/')
  await expect(caja(page)).toBeVisible()
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('Control+k')
  await expect(caja(page)).toBeFocused()
})

test('en el celular la caja y los resultados caben sin scroll horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await caja(page).fill('carta')
  await expect(resultados(page).locator('.home-res__grupo').first()).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})
