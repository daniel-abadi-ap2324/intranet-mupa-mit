/**
 * La página del asistente (/asistente): se llega por el menú y por el botón de la barra superior; responde con
 * aplicaciones, páginas y contenido concreto (boletín, noticia, formulario). El backend de pruebas no tiene servidor
 * de inferencia (sin LLM_URL): las respuestas se simulan; el modelo y el filtrado se prueban en la API.
 */
import { expect, test, type Page } from '@playwright/test'

type Respuesta = { answer: string; applications: string[]; pages?: { path: string; title: string }[]; items?: { kind: string; title: string; path: string; meta: string | null }[] }

/** Simula el asistente (disponible) y devuelve las preguntas que llegaron. */
async function simular(page: Page, respuesta: Respuesta) {
  const preguntas: string[] = []
  await page.route('**/api/assistant/status', (r) => r.fulfill({ json: { available: true } }))
  await page.route('**/api/assistant/ask', async (route) => {
    preguntas.push((route.request().postDataJSON() as { question: string }).question)
    await route.fulfill({ json: { pages: [], items: [], ...respuesta } })
  })
  return preguntas
}

const caja = (page: Page) => page.getByLabel('Tu pregunta para el asistente')

test('se abre desde la barra superior y desde el menú', async ({ page }) => {
  await page.goto('/aplicaciones')
  await page.locator('.app-topbar').getByRole('link', { name: 'Asistente' }).click()
  await expect(page).toHaveURL(/\/asistente$/)
  await expect(page.getByRole('heading', { level: 1, name: /¿En qué te ayudo/ })).toBeVisible()
  await page.goto('/')
  await page.getByRole('navigation').getByRole('link', { name: 'Asistente', exact: true }).click()
  await expect(page).toHaveURL(/\/asistente$/)
})

test('responde con aplicaciones, páginas y contenido concreto, y lleva al boletín', async ({ page }) => {
  const preguntas = await simular(page, {
    answer: 'Aquí está el boletín del reciclaje.',
    applications: ['directorio', 'no-existe'],
    pages: [{ path: '/boletines', title: 'Boletines' }],
    items: [{ kind: 'boletin', title: 'Boletín del 7 de octubre de 2026', path: '/boletines', meta: 'Alcaldía al día' }],
  })
  await page.goto('/asistente')
  await caja(page).fill('boletín del reciclaje')
  await page.getByRole('button', { name: 'Preguntar' }).click()
  const log = page.getByRole('log')
  await expect(log.getByText('Aquí está el boletín del reciclaje.')).toBeVisible()
  // Un slug que no está en el catálogo no se pinta.
  await expect(log.locator('.app-tile')).toHaveCount(1)
  const contenido = log.getByRole('list', { name: 'Contenido de la intranet' })
  await expect(contenido).toContainText('Boletín')
  await expect(contenido).toContainText('Alcaldía al día')
  expect(preguntas).toEqual(['boletín del reciclaje'])
  await contenido.getByRole('link', { name: /Boletín del 7 de octubre/ }).click()
  await expect(page).toHaveURL(/\/boletines$/)
})

test('Enter pregunta, las sugerencias preguntan directo y «Nueva conversación» vuelve al inicio', async ({ page }) => {
  const preguntas = await simular(page, { answer: 'Mira esto.', applications: [] })
  await page.goto('/asistente')
  await page.getByRole('button', { name: 'No me funciona el correo' }).click()
  await expect(page.getByText('Mira esto.')).toBeVisible()
  await caja(page).fill('otra pregunta')
  await caja(page).press('Enter')
  await expect(page.getByRole('log').getByText('otra pregunta')).toBeVisible()
  expect(preguntas).toEqual(['No me funciona el correo', 'otra pregunta'])
  await page.getByRole('button', { name: 'Nueva conversación' }).click()
  await expect(page.getByRole('heading', { level: 1, name: /¿En qué te ayudo/ })).toBeVisible()
})

test('?q= pregunta sola al entrar (lo usan el buscador y el Inicio)', async ({ page }) => {
  const preguntas = await simular(page, { answer: 'Listo.', applications: [] })
  await page.goto('/asistente?q=' + encodeURIComponent('¿dónde pido vacaciones?'))
  await expect(page.getByText('Listo.')).toBeVisible()
  expect(preguntas).toEqual(['¿dónde pido vacaciones?'])
  await expect(page).toHaveURL(/\/asistente$/)
})

test('sin servidor de inferencia avisa con amabilidad y no deja preguntar', async ({ page }) => {
  await page.goto('/asistente')
  await expect(page.getByRole('status').filter({ hasText: /no está incluido en esta copia/ })).toBeVisible()
  await expect(caja(page)).toBeDisabled()
})

test('con «reducir movimiento» la página se ve igual (el fondo queda quieto) y cabe en el celular', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 }, storageState: test.info().project.use.storageState })
  const page = await ctx.newPage()
  await page.route('**/api/assistant/status', (r) => r.fulfill({ json: { available: true } }))
  await page.goto('/asistente')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await ctx.close()
})
