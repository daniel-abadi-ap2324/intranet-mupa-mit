/** Recorrido para usuarios nuevos: aparece la primera vez, se usa con teclado y se puede repetir. */
import { expect, test, type Page } from '@playwright/test'

import { CUENTAS } from './ayuda'

// Estas pruebas empiezan sin el recorrido visto (las demás lo traen visto: playwright.config.ts).
const SIN_VER = { cookies: [], origins: [] }
test.use({ storageState: SIN_VER })
// Aquí el asistente va «no disponible» (no depende de que haya modelo): su tramo está en recorrido-asistente.e2e.spec.ts.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/assistant/status', (r) => r.fulfill({ json: { available: false } }))
})

const bienvenida = (page: Page) => page.getByRole('dialog', { name: 'Te damos la bienvenida a la nueva intranet' })
const tarjeta = (page: Page) => page.locator('.tour__card')

/** Avanza con "Siguiente" hasta el último paso y lo termina. */
async function hastaElFinal(page: Page) {
  for (let k = 0; k < 12; k++) {
    const terminar = tarjeta(page).getByRole('button', { name: 'Terminar' })
    if (await terminar.count()) return terminar.click()
    await tarjeta(page).getByRole('button', { name: 'Siguiente' }).click()
  }
  throw new Error('El recorrido no terminó')
}

test('aparece en la primera visita; "Ahora no" lo guarda y no vuelve a salir', async ({ page }) => {
  await page.goto('/')
  await expect(bienvenida(page)).toBeVisible()
  await expect(bienvenida(page).getByRole('heading')).toBeFocused()
  await bienvenida(page).getByRole('button', { name: 'Ahora no' }).click()
  await expect(tarjeta(page)).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('mupa_recorrido'))).toBeTruthy()

  await page.reload()
  await expect(page.locator('#homeGrid > .home-w').first()).toBeVisible()
  await page.waitForTimeout(1200)
  await expect(tarjeta(page)).toHaveCount(0)
})

test('se recorre con el teclado, un paso a la vez sobre la pantalla real, y Tab no sale de la tarjeta', async ({ page }) => {
  await page.goto('/')
  await expect(bienvenida(page)).toBeVisible()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await expect(tarjeta(page).getByRole('button', { name: 'Empezar' })).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(tarjeta(page).getByRole('heading')).toHaveText('Busca lo que necesitas')
  await expect(tarjeta(page)).toContainText(/Paso 1 de \d/)
  await expect(page.locator('.tour__foco')).toBeVisible()
  for (let k = 0; k < 6; k++) await page.keyboard.press('Tab')
  expect(await page.evaluate(() => !!document.activeElement?.closest('.tour__card'))).toBe(true)

  await tarjeta(page).getByRole('button', { name: 'Siguiente' }).click()
  await expect(tarjeta(page).getByRole('button', { name: 'Atrás' })).toBeVisible()
  await expect(tarjeta(page).getByRole('heading')).not.toHaveText('Busca lo que necesitas')
  // El último paso es Ayuda.
  for (let k = 0; k < 12 && !(await tarjeta(page).getByRole('button', { name: 'Terminar' }).count()); k++) {
    await tarjeta(page).getByRole('button', { name: 'Siguiente' }).click()
  }
  await expect(tarjeta(page).getByRole('heading')).toHaveText('¿Te perdiste?')
  await tarjeta(page).getByRole('button', { name: 'Terminar' }).click()
  await expect(tarjeta(page)).toHaveCount(0)
})

test('Esc lo cierra; se repite desde Ayuda y desde Configuración', async ({ page }) => {
  await page.goto('/')
  await expect(bienvenida(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(tarjeta(page)).toHaveCount(0)

  await page.getByRole('button', { name: 'Ayuda', exact: true }).click()
  await page.getByRole('link', { name: /Ver el recorrido de la intranet/ }).click()
  await expect(bienvenida(page)).toBeVisible()
  await bienvenida(page).getByRole('button', { name: 'Ahora no' }).click()
  await expect(page).toHaveURL(/\/$/)

  await page.goto('/configuracion')
  await page.getByRole('link', { name: 'Ver el recorrido' }).click()
  await expect(bienvenida(page)).toBeVisible()
})

test('con sesión: visto en un navegador, no aparece en otro', async ({ page, browser, baseURL }) => {
  const entrarSin = async (p: Page) => {
    await p.goto('/entrar')
    await p.getByLabel('Cédula o correo').fill(CUENTAS.prueba2)
    await p.getByLabel('Contraseña', { exact: true }).fill('password')
    await p.getByRole('button', { name: 'Entrar' }).click()
    await expect(p).toHaveURL(/\/$/)
    await expect(p.locator('#homeGrid > .home-w').first()).toBeVisible()
  }
  await entrarSin(page)
  // Si esta cuenta todavía no lo vio, aparece: se recorre hasta el final.
  await page.waitForTimeout(1200)
  if (await tarjeta(page).count()) {
    await tarjeta(page).getByRole('button', { name: 'Empezar' }).click()
    await hastaElFinal(page)
  }
  await expect.poll(async () => (await (await page.request.get('/api/auth/session')).json()).tourSeenAt).not.toBeNull()

  const otro = await browser.newContext({ baseURL, storageState: SIN_VER })
  const p2 = await otro.newPage()
  await entrarSin(p2)
  await p2.waitForTimeout(1200)
  await expect(p2.locator('.tour__card')).toHaveCount(0)
  await otro.close()
})

test('en el teléfono, el paso del menú resalta el botón "Más"', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await bienvenida(page).getByRole('button', { name: 'Empezar' }).click()
  for (let k = 0; k < 6 && (await tarjeta(page).getByRole('heading').textContent()) !== 'Todas las secciones'; k++) {
    await tarjeta(page).getByRole('button', { name: 'Siguiente' }).click()
  }
  await expect(tarjeta(page)).toContainText('En «Más» están los sistemas')
  // El recuadro llega al botón "Más" (se mueve con una transición corta).
  const mas = (await page.getByRole('button', { name: 'Más secciones' }).boundingBox())!
  await expect
    .poll(async () => {
      const f = await page.locator('.tour__foco').boundingBox()
      return !!f && f.x <= mas.x + 1 && f.x + f.width >= mas.x + mas.width - 1 && f.y <= mas.y + 1
    })
    .toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})
