/**
 * Las pantallas principales en un teléfono (390 px) y con la auditoría de accesibilidad de axe:
 * sin desplazamiento horizontal de la página y sin fallas graves o críticas (WCAG 2.1 A y AA).
 * Entra una sola vez (el login tiene límite de intentos) y recorre las páginas con la misma sesión.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

import { entrar, vigilarErrores } from './ayuda'

const PAGINAS = ['/', '/asistente', '/aplicaciones', '/mesa-servicios', '/directorio', '/documentos', '/noticias', '/recursos-humanos', '/clinica', '/comunicacion', '/mis-solicitudes']

// Gestión (admin): el contraste de sus tarjetas se revisa aparte; aquí solo que nada se desplace a lo ancho.
const GESTION = ['/gestion/usuarios', '/gestion/aplicaciones']

test.describe.configure({ mode: 'serial' })

let page: Page
let errores: () => string[]

test.beforeAll(async ({ browser }) => {
  const contexto = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: test.info().project.use.storageState })
  page = await contexto.newPage()
  errores = vigilarErrores(page)
  // prueba2: prueba1 la usan las pruebas de solicitudes, que gastan su cupo (429).
  await entrar(page, 'prueba2')
})

test.afterAll(async () => {
  await page.context().close()
})

for (const ruta of PAGINAS) {
  test(`${ruta} se ve bien en el teléfono y pasa axe`, async () => {
    await page.goto(ruta)
    await expect(page.locator('main h1').first()).toBeVisible()
    await page.waitForLoadState('networkidle')

    // Nada se sale de la pantalla a lo ancho.
    const ancho = await page.evaluate(() => ({ pagina: document.documentElement.scrollWidth, ventana: window.innerWidth }))
    expect(ancho.pagina, 'la página se desplaza a lo ancho').toBeLessThanOrEqual(ancho.ventana)

    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    const graves = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
    expect(graves.map((v) => `${v.id} (${v.impact}): ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([])
    expect(errores()).toEqual([])
  })
}

test('/entrar en el teléfono no se desplaza a lo ancho y pasa axe', async ({ browser }) => {
  const contexto = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const anonimo = await contexto.newPage()
  try {
    await anonimo.goto('/entrar')
    await expect(anonimo.locator('main h1').first()).toBeVisible()
    const ancho = await anonimo.evaluate(() => ({ pagina: document.documentElement.scrollWidth, ventana: window.innerWidth }))
    expect(ancho.pagina).toBeLessThanOrEqual(ancho.ventana)
    const { violations } = await new AxeBuilder({ page: anonimo }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([])
  } finally {
    await contexto.close()
  }
})

test('gestión en el teléfono: Usuarios y Catálogo de aplicaciones no se desplazan a lo ancho', async ({ browser }) => {
  const contexto = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: test.info().project.use.storageState })
  const admin = await contexto.newPage()
  try {
    await entrar(admin, 'admin')
    for (const ruta of GESTION) {
      await admin.goto(ruta)
      await expect(admin.locator('h1').first()).toBeVisible()
      await admin.waitForTimeout(800)
      const ancho = await admin.evaluate(() => ({ pagina: document.documentElement.scrollWidth, ventana: window.innerWidth }))
      expect(ancho.pagina, `${ruta} se desplaza a lo ancho`).toBeLessThanOrEqual(ancho.ventana)
    }
  } finally {
    await contexto.close()
  }
})

// El contraste de las etiquetas de estado («Publicada», «Correcto») de estas pantallas ya se corrigió: que no vuelva.
test('guía del logo, catálogo de aplicaciones y boletines de gestión pasan axe (WCAG 2.1 AA, sin fallas graves ni serias)', async ({ browser }) => {
  const contexto = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: test.info().project.use.storageState })
  const admin = await contexto.newPage()
  try {
    await entrar(admin, 'admin')
    for (const ruta of ['/comunicacion/guia-del-logo', '/gestion/aplicaciones', '/gestion/boletines']) {
      await admin.goto(ruta)
      await expect(admin.locator('h1').first()).toBeVisible()
      await admin.waitForTimeout(1000)
      const { violations } = await new AxeBuilder({ page: admin }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      const graves = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
      expect(graves.map((v) => `${ruta}: ${v.id} (${v.impact}) ×${v.nodes.length}`)).toEqual([])
    }
  } finally {
    await contexto.close()
  }
})
