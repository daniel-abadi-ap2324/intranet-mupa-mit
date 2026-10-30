/**
 * Utilidades de las pruebas de punta a punta. Usan las cuentas FICTICIAS que
 * crea el backend de pruebas (`npm run e2e:serve` en mupa-intranet-api,
 * contraseña "password").
 */
import { expect, type APIRequestContext, type Page } from '@playwright/test'

export const CUENTAS = {
  admin: 'admin@ejemplo.test',
  comunicacion: 'comunicacion@ejemplo.test',
  gestor: 'gestor@ejemplo.test',
  prueba1: 'prueba1@ejemplo.test',
  prueba2: 'prueba2@ejemplo.test',
  /** Viene sin departamento: la intranet se lo pide al entrar. */
  sindepto: 'sindepto@ejemplo.test',
} as const
type Cuenta = keyof typeof CUENTAS

/** Entra por la pantalla /entrar, como lo haría una persona. */
export async function entrar(page: Page, quien: Cuenta) {
  await page.goto('/entrar')
  await page.getByLabel('Cédula o correo').fill(CUENTAS[quien])
  await page.getByLabel('Contraseña', { exact: true }).fill('password')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.locator('#homeGrid > .home-w').first()).toBeVisible()
}

/**
 * Junta los errores de la página (consola y excepciones) desde ya; la función
 * devuelta da los inesperados.
 */
export function vigilarErrores(page: Page): () => string[] {
  const errores: string[] = []
  page.on('console', (m) => m.type() === 'error' && errores.push(m.text()))
  page.on('pageerror', (e) => errores.push(e.message))
  return () => [...errores]
}

/** Inicia sesión en la API con esa cuenta (la cookie queda en `request`) para preparar o limpiar datos. */
export async function api(request: APIRequestContext, quien: Cuenta) {
  const r = await request.post('/api/auth/login', { data: { username: CUENTAS[quien], password: 'password' } })
  expect(r.ok()).toBeTruthy()
  return {
    put: (url: string, data: unknown) => request.put(url, { data }),
  }
}

/** Deja el Inicio de esa cuenta como el de todos (sin diseño propio). */
export async function reiniciarInicio(request: APIRequestContext, quien: Cuenta) {
  const c = await api(request, quien)
  expect((await c.put('/api/home/layout', { layout: null })).ok()).toBeTruthy()
}

/** Orden de los bloques del Inicio que se mueven (sin el fijo del buscador), como lo ve la persona. */
export async function ordenInicio(page: Page) {
  await page.locator('#homeGrid > .home-w').first().waitFor()
  return page.locator('#homeGrid > .home-w:not([data-uid=buscador])').evaluateAll((ws) => ws.map((w) => (w as HTMLElement).dataset.uid ?? ''))
}

/** Arrastra un bloque por su asa hasta otro (mouse real, con pasos intermedios). */
export async function arrastrar(page: Page, desde: string, hasta: string) {
  const asa = page.locator(`.home-w[data-uid=${desde}] .home-w__grip`)
  const destino = page.locator(`.home-w[data-uid=${hasta}]`)
  // Centrado: cerca del borde de la ventana, dnd-kit desplaza la página mientras se arrastra.
  await destino.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
  const inicial = await ordenInicio(page)
  const subiendo = inicial.indexOf(desde) > inicial.indexOf(hasta)

  // Que el asa no quede debajo de la barra superior fija (ahí el clic caería en la barra).
  let a = (await asa.boundingBox())!
  if (a.y < 120) {
    await page.evaluate((dy) => window.scrollBy({ top: dy, behavior: 'instant' }), a.y - 200)
    a = (await asa.boundingBox())!
  }
  const x0 = a.x + a.width / 2
  const y0 = a.y + a.height / 2
  await page.mouse.move(x0, y0)
  await page.mouse.down()
  await page.mouse.move(x0 + 8, y0 + 8, { steps: 3 })
  const d = (await destino.boundingBox())!
  const x1 = d.x + 30
  const y1 = d.y + d.height / 2
  // Como una persona: pasos cortos con pausas (la cuadrícula se reacomoda mientras se arrastra).
  const PASOS = 15
  for (let i = 1; i <= PASOS; i++) {
    await page.mouse.move(x0 + ((x1 - x0) * i) / PASOS, y0 + ((y1 - y0) * i) / PASOS)
    await page.waitForTimeout(40)
  }
  // Se suelta cuando el hueco ya está donde se apunta.
  const llego = (o: string[]) => (subiendo ? o.indexOf(desde) < o.indexOf(hasta) : o.indexOf(desde) > o.indexOf(hasta))
  let o = await ordenInicio(page)
  for (const t0 = Date.now(); !llego(o) && Date.now() - t0 < 3000; o = await ordenInicio(page)) await page.waitForTimeout(100)
  if (!llego(o)) {
    const scroll = await page.evaluate(() => Math.round(scrollY))
    throw new Error(`El hueco de «${desde}» no llegó a «${hasta}». Orden: ${o.join(',')}. Puntero en ${Math.round(x1)},${Math.round(y1)}; scrollY ${scroll}.`)
  }
  await page.mouse.up()
}

/** Las secciones de la barra azul de la gestión (la página aparte de /gestion). */
export const paneles = (page: Page) => page.locator('.gx-nav')

/** Como una persona: del menú lateral al Centro de Gestión y, desde su barra de paneles, a esa pantalla. */
/** «Tu panel de gestión» del Inicio, desplegado (desde oct-2026 empieza plegado). */
export async function panelGestion(page: Page) {
  const panel = page.getByRole('region', { name: 'Tu panel de gestión' })
  await expect(panel).toBeVisible()
  const mostrar = panel.getByRole('button', { name: 'Mostrar' })
  if (await mostrar.isVisible()) await mostrar.click()
  return panel
}

export async function abrirPanel(page: Page, nombre: string) {
  await page.locator('#sidebar').getByRole('link', { name: 'Centro de Gestión' }).click()
  await expect(page).toHaveURL(/\/gestion$/)
  // La barra azul trae todas las secciones; las de cada área están plegadas hasta abrir su flecha.
  await expect(paneles(page).getByRole('link', { name: 'Resumen', exact: true })).toBeVisible()
  const enlace = paneles(page).getByRole('link', { name: nombre, exact: true })
  const mostrar = paneles(page).getByRole('button', { name: /^Mostrar / })
  while (!(await enlace.isVisible()) && (await mostrar.count())) await mostrar.first().click()
  await enlace.click()
}
