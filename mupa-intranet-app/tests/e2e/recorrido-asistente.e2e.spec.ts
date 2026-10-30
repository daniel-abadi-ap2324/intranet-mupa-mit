/**
 * El tramo del asistente del recorrido: lleva de verdad a /asistente, escribe una pregunta de ejemplo (o deja
 * escribir la propia), la envía, muestra la respuesta con su explicación y vuelve a la intranet. El modelo se
 * simula con page.route: estas pruebas no dependen de que haya un servidor de inferencia.
 */
import { expect, test, type Page } from '@playwright/test'

// Sin el recorrido «visto» (las demás pruebas lo traen visto: playwright.config.ts).
test.use({ storageState: { cookies: [], origins: [] } })

const EJEMPLO = '¿Cuál es la extensión de la Mesa de Servicios?'
const PASO_ASISTENTE = '¿No sabes qué sistema usar?'
const tarjeta = (page: Page) => page.locator('.tour__card')
const titulo = (page: Page) => tarjeta(page).getByRole('heading')

async function simular(page: Page, opciones: { disponible?: boolean; ask?: 'ok' | '429' } = {}) {
  const preguntas: string[] = []
  await page.route('**/api/assistant/status', (r) => r.fulfill({ json: { available: opciones.disponible ?? true } }))
  await page.route('**/api/assistant/ask', async (r) => {
    preguntas.push(r.request().postDataJSON().question)
    if (opciones.ask === '429') {
      return r.fulfill({ status: 429, json: { error: 'TOO_MANY_REQUESTS', message: 'Hiciste muchas preguntas seguidas. Espera unos minutos e intenta de nuevo.' } })
    }
    await r.fulfill({
      json: {
        answer: 'La Mesa de Servicios es la extensión 1400.',
        applications: [],
        pages: [{ path: '/mesa-servicios', title: 'Mesa de Servicios' }],
        items: [],
      },
    })
  })
  return preguntas
}

/** Abre el recorrido y avanza con «Siguiente» hasta el paso con ese título. */
async function hastaPaso(page: Page, nombre: string) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Empezar' }).click()
  for (let k = 0; k < 8 && (await titulo(page).textContent()) !== nombre; k++) {
    await tarjeta(page).getByRole('button', { name: 'Siguiente' }).click()
  }
  await expect(titulo(page)).toHaveText(nombre)
}

/** Termina el recorrido desde donde esté, con «Siguiente» hasta «Terminar». */
async function hastaElFinal(page: Page) {
  for (let k = 0; k < 10; k++) {
    const terminar = tarjeta(page).getByRole('button', { name: 'Terminar' })
    if (await terminar.count()) return terminar.click()
    await tarjeta(page).getByRole('button', { name: 'Siguiente' }).click()
  }
  throw new Error('El recorrido no terminó')
}

test('lleva a /asistente, escribe y envía la pregunta de ejemplo, muestra la respuesta, vuelve y termina', async ({ page }) => {
  const preguntas = await simular(page)
  await hastaPaso(page, PASO_ASISTENTE)
  await tarjeta(page).getByRole('button', { name: 'Probar el asistente' }).click()

  await expect(page).toHaveURL(/\/asistente$/)
  await expect(titulo(page)).toHaveText('Así le preguntas')
  await expect(page.locator('.tour__foco')).toBeVisible()
  await tarjeta(page).getByRole('button', { name: 'Usar el ejemplo' }).click()
  // Se escribe en la caja y se envía solo.
  await expect(page.locator('#asis-pregunta')).toHaveValue(/Mesa/)
  await expect(titulo(page)).toHaveText('Esta es su respuesta')
  expect(preguntas).toEqual([EJEMPLO])
  await expect(page.locator('.app-asistente__a')).toContainText('extensión 1400')
  await expect(tarjeta(page)).toContainText('enlaces a la página')
  await expect(page.locator('.app-asistente__paginas').getByRole('link', { name: 'Mesa de Servicios' })).toBeVisible()

  await tarjeta(page).getByRole('button', { name: 'Volver a la intranet' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(titulo(page)).toHaveText('Todas las secciones')
  await hastaElFinal(page)
  await expect(tarjeta(page)).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('mupa_recorrido'))).toBeTruthy()
})

test('con «reducir movimiento» la pregunta aparece escrita de una vez', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await simular(page)
  await hastaPaso(page, PASO_ASISTENTE)
  await tarjeta(page).getByRole('button', { name: 'Probar el asistente' }).click()
  await tarjeta(page).getByRole('button', { name: 'Usar el ejemplo' }).click()
  await expect(page.locator('#asis-pregunta')).toHaveValue(EJEMPLO, { timeout: 1500 })
  await expect(titulo(page)).toHaveText('Esta es su respuesta')
})

test('la persona puede escribir su propia pregunta y el recorrido sigue cuando llega la respuesta', async ({ page }) => {
  const preguntas = await simular(page)
  await hastaPaso(page, PASO_ASISTENTE)
  await tarjeta(page).getByRole('button', { name: 'Probar el asistente' }).click()
  await page.locator('#asis-pregunta').focus()
  await page.locator('#asis-pregunta').fill('No me funciona el correo')
  await page.keyboard.press('Enter')
  await expect(titulo(page)).toHaveText('Esta es su respuesta')
  expect(preguntas).toEqual(['No me funciona el correo'])
})

test('con teclado: Esc en la página del asistente cierra el recorrido y vuelve a la intranet', async ({ page }) => {
  await simular(page)
  await hastaPaso(page, PASO_ASISTENTE)
  await tarjeta(page).getByRole('button', { name: 'Probar el asistente' }).click()
  await expect(titulo(page)).toHaveText('Así le preguntas')
  await page.locator('#asis-pregunta').focus()
  await page.keyboard.press('Escape')
  await expect(tarjeta(page)).toHaveCount(0)
  await expect(page).toHaveURL(/\/$/)
})

test('en el paso del asistente solo hay «Omitir recorrido», «Atrás» y «Usar el ejemplo»; «Omitir recorrido» cierra', async ({ page }) => {
  await simular(page)
  await hastaPaso(page, PASO_ASISTENTE)
  await tarjeta(page).getByRole('button', { name: 'Probar el asistente' }).click()
  await expect(titulo(page)).toHaveText('Así le preguntas')
  await expect(tarjeta(page).getByRole('button')).toHaveText(['Omitir recorrido', 'Atrás', 'Usar el ejemplo'])
  await tarjeta(page).getByRole('button', { name: 'Omitir recorrido' }).click()
  await expect(tarjeta(page)).toHaveCount(0)
})

test('si el asistente responde con error (429), el paso lo dice y el recorrido sigue', async ({ page }) => {
  await simular(page, { ask: '429' })
  await hastaPaso(page, PASO_ASISTENTE)
  await tarjeta(page).getByRole('button', { name: 'Probar el asistente' }).click()
  await tarjeta(page).getByRole('button', { name: 'Usar el ejemplo' }).click()
  await expect(titulo(page)).toHaveText('Esta es su respuesta')
  await expect(tarjeta(page)).toContainText('Hiciste muchas preguntas seguidas')
  await tarjeta(page).getByRole('button', { name: 'Volver a la intranet' }).click()
  await expect(titulo(page)).toHaveText('Todas las secciones')
  await hastaElFinal(page)
  await expect(tarjeta(page)).toHaveCount(0)
})

test('asistente no disponible: el recorrido lo explica, no entra a /asistente y termina', async ({ page }) => {
  await simular(page, { disponible: false })
  await hastaPaso(page, 'El asistente')
  await expect(tarjeta(page)).toContainText('Ahora no está disponible')
  await expect(tarjeta(page).getByRole('button', { name: 'Probar el asistente' })).toHaveCount(0)
  await tarjeta(page).getByRole('button', { name: 'Siguiente' }).click()
  await expect(titulo(page)).toHaveText('Todas las secciones')
  await expect(page).toHaveURL(/\/$/)
  await hastaElFinal(page)
  await expect(tarjeta(page)).toHaveCount(0)
})

test('en el teléfono, el tramo del asistente cabe y sus botones se pueden tocar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await simular(page)
  await hastaPaso(page, PASO_ASISTENTE)
  await tarjeta(page).getByRole('button', { name: 'Probar el asistente' }).click()
  await expect(titulo(page)).toHaveText('Así le preguntas')
  for (const b of await tarjeta(page).getByRole('button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(43)
  await tarjeta(page).getByRole('button', { name: 'Usar el ejemplo' }).click()
  await expect(titulo(page)).toHaveText('Esta es su respuesta')
  const c = (await tarjeta(page).boundingBox())!
  expect(c.x).toBeGreaterThanOrEqual(0)
  expect(c.x + c.width).toBeLessThanOrEqual(390)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})
