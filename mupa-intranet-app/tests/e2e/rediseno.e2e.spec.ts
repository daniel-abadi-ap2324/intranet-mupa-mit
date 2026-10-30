/**
 * Pestañas como en el rediseño: Recursos Humanos con lo que espera la API de RRHH
 * marcado «Próximamente», Documentos solo con documentos y Aplicaciones con una
 * sola caja que también le pregunta al asistente (simulado: no hay servidor de IA).
 */
import { expect, test, type Page } from '@playwright/test'

import { vigilarErrores } from './ayuda'

async function asistentePrendido(page: Page, respuesta?: { answer: string; applications: string[] }) {
  await page.route('**/api/assistant/status', (r) => r.fulfill({ json: { available: true } }))
  if (respuesta) await page.route('**/api/assistant/ask', (r) => r.fulfill({ json: respuesta }))
}

test('Recursos Humanos: documentos y contacto, sin la Clínica y sin «Cómo solicitar» si no hay RRHH Express conectado', async ({ page }) => {
  const errores = vigilarErrores(page)
  await page.goto('/recursos-humanos')
  const datos = page.locator('.rh-dato')
  await expect(datos).toHaveCount(4)
  await expect(datos.first()).toContainText('Vacaciones disponibles')
  await expect(datos.first()).toContainText('Próximamente')

  // «Documentos y formatos»: solo lo que tiene archivo (Bienestar y Equiparación, sin contenido, no salen).
  const info = page.locator('section[aria-labelledby="h-rh-docs"]')
  await expect(info.locator('.rh-doc')).toHaveCount(3)
  await expect(info.getByRole('link', { name: /Código de Ética/ })).toHaveAttribute('href', /CODIGO-DE-ETICA01\.pdf$/)
  // El Reglamento se muestra normal: Daniel confirmó su vigencia (21-oct-2026).
  const reglamento = info.getByRole('link', { name: /Reglamento Interno/ })
  await expect(reglamento).toHaveAttribute('href', /Reglamento-Interno-de-Personal-Decreto-024-2019\.pdf$/)
  await expect(reglamento).not.toContainText(/Pendiente|Por confirmar/)
  for (const t of ['Bienestar', 'Equiparación de Oportunidades']) await expect(info.locator('.rh-doc', { hasText: t })).toHaveCount(0)
  // La Clínica tiene su propio lugar en el menú: no sale en esta página.
  await expect(page.locator('#contenido')).not.toContainText('Clínica Municipal')

  // «Cómo solicitar» solo se muestra con RRHH Express conectado (ver rrhh.e2e); aquí no hay conexión.
  await expect(page.locator('details.rh-como')).toHaveCount(0)
  // Lo que ya funciona sí: el ACH (PDF), en «Documentos y formatos».
  await expect(page.getByRole('link', { name: /Afiliación a pagos por ACH/ })).toHaveAttribute('href', /\.pdf$/)
  await expect(page.locator('.rh-contacto')).toContainText('506-9692')
  expect(errores()).toEqual([])
})

test('Documentos: solo documentos, sin formularios en línea', async ({ page }) => {
  await page.goto('/documentos')
  await expect(page.locator('.doc-grid .doc-card').first()).toBeVisible()
  await expect(page.getByRole('group', { name: 'Filtrar por categoría' }).getByRole('button', { name: /Formularios/ })).toHaveCount(0)
  await expect(page.locator('main a[href^="/formularios"]')).toHaveCount(0)
  await expect(page.getByText('Afiliación a pagos por ACH')).toHaveCount(0)
  // Los permisos en PDF se quedan.
  await expect(page.locator('.permits .list-row')).toHaveCount(3)
})

test('Aplicaciones: una sola caja que filtra y le pregunta al asistente, sin favoritos ni más filtros', async ({ page }) => {
  await asistentePrendido(page, { answer: 'Para el correo usa Correo institucional.', applications: ['correo'] })
  await page.goto('/aplicaciones')
  await expect(page.getByRole('heading', { name: 'Mis favoritos' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Más filtros/ })).toHaveCount(0)
  await expect(page.getByText('Solo confirmadas')).toHaveCount(0)

  const caja = page.getByLabel('Buscar aplicación')
  await caja.fill('correo')
  await expect(page.locator('.app-catalog .app-tile').first()).toContainText(/Correo/)
  await page.getByRole('button', { name: 'Preguntar al asistente' }).click()
  const tarjeta = page.locator('.home-asis')
  await expect(tarjeta).toContainText('Para el correo usa Correo institucional.')
  await expect(tarjeta.locator('.app-tile')).toHaveCount(1)
  // Arriba de la grilla.
  expect(await tarjeta.evaluate((t) => !!(t.compareDocumentPosition(document.querySelector('.app-catalog')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true)
  await tarjeta.getByRole('button', { name: 'Nueva pregunta' }).click()
  await expect(tarjeta).toHaveCount(0)

  // Sin resultados: ofrece preguntarle al asistente y la Mesa de Servicios.
  await caja.fill('zzqqxx')
  await expect(page.locator('main .empty-state')).toContainText('No encontramos «zzqqxx»')
  await expect(page.locator('main .empty-state').getByRole('button', { name: 'Preguntarle al asistente' })).toBeVisible()
  await expect(page.locator('main .empty-state').getByRole('link', { name: /Mesa de Servicios, ext\. 1400/ })).toBeVisible()
})

test('Aplicaciones: sin asistente disponible no se ofrece preguntarle', async ({ page }) => {
  await page.goto('/aplicaciones')
  await expect(page.getByLabel('Buscar aplicación')).toBeVisible()
  await expect(page.locator('.app-catalog .app-tile').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Preguntar al asistente' })).toHaveCount(0)
})

test('Inicio: el bloque del saludo y la búsqueda no tiene descripciones y se le cambia el tamaño', async ({ page }) => {
  await page.goto('/')
  const bloque = page.locator('.home-w[data-uid="buscador"]')
  await expect(bloque).toHaveAttribute('data-ancho', 'completa')
  await expect(bloque.locator('.hero__intro, .home-search__ayuda')).toHaveCount(0)

  await page.getByRole('button', { name: /Personalizar/ }).click()
  await page.getByLabel('Tamaño de «Saludo y búsqueda»').selectOption('media')
  // Es fijo: no se mueve ni se quita.
  await expect(bloque.getByRole('button', { name: /Quitar|Subir|Bajar/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await page.reload()
  await expect(bloque).toHaveAttribute('data-ancho', 'media')
  await expect(page.getByLabel('¿Qué necesitas hoy?')).toBeVisible()
})
