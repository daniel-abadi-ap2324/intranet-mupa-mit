/** Sitio sin sesión: pantallas, navegación de SPA, buscador con categorías, catálogo y móvil. */
import { expect, test } from '@playwright/test'

import { vigilarErrores } from './ayuda'

test.describe('sin sesión', () => {
  test('el Inicio carga sus bloques sin errores (tampoco de CSP)', async ({ page }) => {
    const errores = vigilarErrores(page)
    await page.goto('/')
    // 9 bloques y el del saludo y la búsqueda (fijo: sin asa).
    await expect(page.locator('#homeGrid > .home-w')).toHaveCount(10)
    await expect(page.locator('.home-w__grip')).toHaveCount(9)
    await expect(page.locator('.quick-apps .app-tile').first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Iniciar sesión', exact: true })).toBeVisible()
    await expect(page.locator('body')).not.toContainText('undefined')
    await expect(page).toHaveTitle('Inicio — Intranet MUPA')
    expect(errores()).toEqual([])
  })

  test('los accesos rápidos por defecto traen WIFI y código de llamadas (no el ACH) y Soporte ISTMO abre su página', async ({ page }) => {
    await page.goto('/')
    const accesos = page.locator('.quick-apps')
    await expect(accesos.locator('a[href="http://wifi.mupa.gob.pa:9001/solicitud"]')).toHaveCount(1)
    await expect(accesos.locator('a[href="https://cdr.mupa.gob.pa/pinrequests/create"]')).toHaveCount(1)
    await expect(accesos.locator('a[href*="Afiliacion_a_Pagos_por_ACH"]')).toHaveCount(0)
    await accesos.locator('a[href="/sap-istmo"]').click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Soporte ISTMO (MEF)')
  })

  test('navega sin recargar la página (SPA)', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => ((window as unknown as { __spa: number }).__spa = 1))
    await page.locator('#sidebar').getByRole('link', { name: 'Aplicaciones' }).click()
    await expect(page).toHaveURL(/\/aplicaciones$/)
    await expect(page.getByRole('heading', { name: 'Aplicaciones de la Alcaldía' })).toBeVisible()
    await expect(page).toHaveTitle('Aplicaciones — Intranet MUPA')
    // Un <a href> normal (tarjeta de una aplicación interna) tampoco recarga.
    await page.locator('section:has(#catalog-title) .app-tile a[href="/directorio"]').first().click()
    await expect(page).toHaveURL(/\/directorio$/)
    expect(await page.evaluate(() => (window as unknown as { __spa?: number }).__spa)).toBe(1)
    // Atrás del navegador también funciona.
    await page.goBack()
    await expect(page).toHaveURL(/\/aplicaciones$/)
  })

  test('el buscador de la barra (fuera del Inicio) separa los resultados por categoría', async ({ page }) => {
    await page.goto('/directorio')
    await page.locator('.app-search__input').fill('salud')
    const chips = page.locator('.app-search__scope')
    await expect(chips.first()).toContainText('Todo')
    await expect(chips.filter({ hasText: 'Aplicaciones' })).toBeVisible()
    await chips.filter({ hasText: 'Aplicaciones' }).click()
    await expect(page.locator('.app-search__item').first()).toBeVisible()
  })

  test('Aplicaciones filtra por etiqueta y lo guarda en la dirección', async ({ page }) => {
    await page.goto('/aplicaciones?etiqueta=salud')
    await expect(page.locator('.count-note')).toHaveText(/^2 de \d+$/)
    await page.getByRole('button', { name: /Quitar filtros/ }).click()
    await expect(page).toHaveURL(/\/aplicaciones$/)
    await page.getByLabel('Buscar aplicación').fill('tributario')
    await expect(page).toHaveURL(/q=tributario/)
    await expect(page.locator('section:has(#catalog-title) .app-tile').first()).toContainText('ARI')
    // Al recargar con esa dirección, el filtro sigue puesto.
    await page.reload()
    await expect(page.getByLabel('Buscar aplicación')).toHaveValue('tributario')
  })

  test('Aplicaciones aplica un filtro que llega por un enlace estando ya en la página', async ({ page }) => {
    await page.goto('/aplicaciones')
    await expect(page.locator('main h1').first()).toBeVisible()
    // Como un resultado "Área" del buscador: un enlace interno a /aplicaciones?area=…
    await page.evaluate(() => {
      const a = document.createElement('a')
      a.href = '/aplicaciones?area=Finanzas'
      a.id = 'enlace-area'
      a.textContent = 'Finanzas'
      document.querySelector('main')!.prepend(a)
    })
    await page.click('#enlace-area')
    await expect(page).toHaveURL(/area=Finanzas/)
    await expect(page.getByRole('button', { name: /^Finanzas/ })).toHaveAttribute('aria-pressed', 'true')
  })

  test('una dirección que no existe es "Página no encontrada"', async ({ page }) => {
    await page.goto('/no-existe')
    await expect(page.getByRole('heading', { name: 'Página no encontrada' })).toBeVisible()
    await expect(page).toHaveTitle('Página no encontrada — Intranet MUPA')
  })

  test('todos los destinos del menú tienen su página (ninguno queda "En migración")', async ({ page, request }) => {
    await page.goto('/')
    await expect(page.locator('#sidebar a[href^="/"]').first()).toBeAttached()
    const enlaces = await page.locator('#sidebar a[href^="/"]').evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute('href')!))])
    // Un archivo local (PDF) no es una ruta de la SPA: el navegador lo abre directo, sin <h1>.
    const archivos = enlaces.filter((h) => /\.[a-z0-9]{2,5}$/i.test(h))
    const rutas = enlaces.filter((h) => !archivos.includes(h))
    expect(rutas.length).toBeGreaterThan(12)
    for (const r of rutas) {
      await page.goto(r)
      await expect(page.locator('main h1').first(), r).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Página no encontrada' }), r).toHaveCount(0)
    }
    for (const a of archivos) expect((await request.get(a)).status(), a).toBe(200)
  })

  test('en el celular es una sola columna sin scroll horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await page.locator('#homeGrid > .home-w').first().waitFor()
    const anchos = await page.locator('#homeGrid > .home-w').evaluateAll((ws) => ws.slice(0, 4).map((w) => Math.round(w.getBoundingClientRect().width)))
    expect(new Set(anchos).size).toBe(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })

  test('en el celular, Escape cierra el menú "Más" y devuelve el foco al botón', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    const mas = page.getByRole('button', { name: 'Más secciones' })
    await mas.click()
    await expect(mas).toHaveAttribute('aria-expanded', 'true')
    await page.keyboard.press('Escape')
    await expect(mas).toHaveAttribute('aria-expanded', 'false')
    await expect(mas).toBeFocused()
  })

  test('al cambiar de página el foco pasa al título (lectores de pantalla)', async ({ page }) => {
    await page.goto('/')
    await page.locator('#sidebar').getByRole('link', { name: 'Directorio', exact: true }).click()
    await expect(page).toHaveURL(/\/directorio$/)
    await expect(page.locator('#contenido h1').first()).toBeFocused()
  })
})
