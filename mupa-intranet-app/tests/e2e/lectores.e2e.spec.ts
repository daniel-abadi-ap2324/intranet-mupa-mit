/** Leer boletines y noticias dentro de la intranet: el PDF en la misma página y la noticia con su texto. */
import { expect, test } from '@playwright/test'

import { vigilarErrores } from './ayuda'

test('Boletín: «Leer» abre el PDF dentro de la página y se pasa de un boletín a otro', async ({ page }) => {
  const errores = vigilarErrores(page)
  await page.goto('/boletines')
  await page.locator('.bol-row').first().getByRole('link', { name: /^Leer el boletín/ }).click()

  await expect(page).toHaveURL(/\/boletines\/\d+$/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Alcaldía al día')
  const visor = page.locator('iframe.bol-lector')
  await expect(visor).toHaveAttribute('src', /^\/(sitio|api\/files)\//)
  await expect(page.getByRole('link', { name: /Abrir el PDF del/ })).toHaveAttribute('target', '_blank')
  await expect(page.getByRole('link', { name: 'Descargar' })).toHaveAttribute('download', '')

  // El más nuevo no tiene «siguiente»; sí «anterior» (el que sigue en la lista): al usarlo, cambia la página y el visor.
  const urlAntes = page.url()
  const srcAntes = await visor.getAttribute('src')
  await page.locator('.bol-nav [rel="prev"]').click()
  await expect(page).not.toHaveURL(urlAntes)
  await expect(visor).not.toHaveAttribute('src', srcAntes!)
  await expect(page.locator('.bol-nav [rel="next"]')).toBeVisible()

  await page.getByRole('link', { name: 'Todos los boletines' }).click()
  await expect(page).toHaveURL(/\/boletines$/)
  expect(errores()).toEqual([])
})

test('Boletín que no existe da «Página no encontrada»', async ({ page }) => {
  await page.goto('/boletines/999999')
  await expect(page.getByRole('heading', { name: 'Página no encontrada' })).toBeVisible()
})

// El texto de una noticia solo lo trae la sincronización con mupa.gob.pa (no hay otra forma de crearlo):
// aquí se simulan las respuestas de la API.
const NOTICIA = { id: 7, title: 'Hatillo enciende sus luces', summary: 'Resumen corto', type: 'noticia', date: '2026-10-02', link: 'https://mupa.gob.pa/hatillo/', imageUrl: null, hasBody: true }

test('Noticia con texto: la fila lleva a su lectura y ahí se lee completa, con el enlace al original', async ({ page }) => {
  const errores = vigilarErrores(page)
  await page.route('**/api/news', (r) => r.fulfill({ json: [NOTICIA, { ...NOTICIA, id: 8, title: 'Sin texto aquí', hasBody: false, link: 'https://mupa.gob.pa/otra/' }] }))
  await page.route('**/api/news/7', (r) => r.fulfill({ json: { ...NOTICIA, body: 'Primer párrafo de la noticia.\n\nSegundo párrafo con más detalle.' } }))

  await page.goto('/noticias')
  // La que no tiene texto sigue yendo directo a su enlace (pestaña nueva); la que sí, a su lectura.
  await expect(page.getByRole('link', { name: /Sin texto aquí/ })).toHaveAttribute('target', '_blank')
  await page.getByRole('link', { name: /Hatillo enciende sus luces/ }).click()

  await expect(page).toHaveURL(/\/noticias\/7$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Hatillo enciende sus luces' })).toBeVisible()
  await expect(page.getByText('Primer párrafo de la noticia.')).toBeVisible()
  await expect(page.getByText('Segundo párrafo con más detalle.')).toBeVisible()
  await expect(page.getByRole('link', { name: /Ver la publicación original/ })).toHaveAttribute('href', 'https://mupa.gob.pa/hatillo/')
  await page.getByRole('link', { name: '← Todas las noticias' }).click()
  await expect(page).toHaveURL(/\/noticias$/)
  expect(errores()).toEqual([])
})

test('Noticia que no existe o no tiene texto da «Página no encontrada»', async ({ page }) => {
  await page.route('**/api/news/9', (r) => r.fulfill({ status: 404, json: { error: 'NEWS_WITHOUT_BODY', message: 'La noticia no tiene texto para leer aquí.' } }))
  await page.goto('/noticias/9')
  await expect(page.getByRole('heading', { name: 'Página no encontrada' })).toBeVisible()
})

test('Boletines: buscar por tema, por palabra clave y por mes; sin resultados lo dice', async ({ page }) => {
  const errores = vigilarErrores(page)
  await page.goto('/boletines')
  const filas = page.locator('.bol-row')
  // Esperar a que carguen antes de contarlas (contar de una daba 0 a veces).
  await expect(filas.nth(10)).toBeVisible()
  const total = await filas.count()
  expect(total).toBeGreaterThan(10)
  // Cada boletín trae su descripción corta (los titulares de su PDF).
  await expect(page.locator('.bol-row .bol-desc').first()).not.toBeEmpty()

  // Un tema que sale en un solo boletín (el del 18 de junio de 2025), con mayúsculas y sin importar tildes.
  const campo = page.getByRole('searchbox', { name: 'Buscar en los boletines' })
  await campo.fill('MOTORIZADOS')
  await expect(filas).toHaveCount(1)
  await expect(page).toHaveURL(/q=MOTORIZADOS/)
  await expect(filas.first()).toContainText('18 de junio de 2025')
  await expect(filas.first().locator('.bol-desc')).toContainText('motorizados')
  await expect(page.locator('.count-note').first()).toContainText('1 boletín encontrado')

  // Tocar una palabra clave busca con ella.
  const clave = filas.first().locator('.bol-clave').first()
  const palabra = (await clave.textContent())!.trim()
  await clave.click()
  await expect(campo).toHaveValue(palabra)
  await expect(filas.first()).toBeVisible()

  // Por mes: sale más de uno.
  await campo.fill('diciembre')
  await expect.poll(() => filas.count()).toBeGreaterThan(3)

  // Sin resultados: avisa y deja volver a ver todos.
  await campo.fill('xyzzyx')
  await expect(page.getByText(/No hay boletines con «xyzzyx»/)).toBeVisible()
  await page.getByRole('button', { name: 'Ver todos' }).click()
  await expect(campo).toHaveValue('')
  await expect(filas).toHaveCount(total)
  expect(errores()).toEqual([])
})

test('Boletín: el lector muestra su descripción y sus palabras clave llevan al buscador', async ({ page }) => {
  await page.goto('/boletines?q=motorizados')
  await page.locator('.bol-row').first().getByRole('link', { name: /^Leer el boletín/ }).click()
  await expect(page.locator('.bol-resumen')).toContainText('motorizados')
  const clave = page.locator('.bol-claves--lector .bol-clave').first()
  const palabra = (await clave.textContent())!.trim()
  await clave.click()
  await expect(page).toHaveURL(new RegExp('/boletines[?]q=' + encodeURIComponent(palabra)))
  await expect(page.getByRole('searchbox', { name: 'Buscar en los boletines' })).toHaveValue(palabra)
})
