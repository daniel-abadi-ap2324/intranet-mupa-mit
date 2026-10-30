/** Bloques o lista, como Google Drive: bloques de entrada, la elección se recuerda y vale para las otras páginas. */
import { expect, test } from '@playwright/test'

import { vigilarErrores } from './ayuda'

test('Documentos empieza en bloques, pasa a lista y la elección se recuerda en Manuales', async ({ page }) => {
  const errores = vigilarErrores(page)
  await page.goto('/documentos')
  const vista = page.getByRole('group', { name: 'Ver como' })
  await expect(vista.getByRole('button', { name: 'Bloques' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.doc-grid.vista-bloques .doc-card').first()).toBeVisible()
  // En bloques, cada PDF muestra su primera página arriba de la tarjeta (y la imagen carga).
  const mini = page.locator('.vista-bloques .doc-card .ic--img img').first()
  await expect(mini).toHaveAttribute('src', /^\/sitio\/miniaturas\/.+\.webp$/)
  await expect.poll(() => mini.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0)

  await vista.getByRole('button', { name: 'Lista' }).click()
  await expect(vista.getByRole('button', { name: 'Lista' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.vista-bloques')).toHaveCount(0)
  await expect(page.locator('.doc-grid .doc-card').first()).toBeVisible()

  await page.goto('/manuales')
  await expect(page.getByRole('group', { name: 'Ver como' }).getByRole('button', { name: 'Lista' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.panel .doc-list .doc-row').first()).toBeVisible()
  await page.getByRole('group', { name: 'Ver como' }).getByRole('button', { name: 'Bloques' }).click()
  await expect(page.locator('.doc-list.vista-bloques .doc-row').first()).toBeVisible()
  expect(errores()).toEqual([])
})

test('Boletines en bloques: la portada grande y «Leer» y «Abrir PDF» en cada tarjeta', async ({ page }) => {
  await page.goto('/boletines')
  const tarjeta = page.locator('.bol-lista.vista-bloques .bol-row').first()
  await expect(tarjeta).toBeVisible()
  await expect(tarjeta.getByRole('link', { name: /^Leer el boletín/ })).toHaveAttribute('href', /^\/boletines\/\d+$/)
  await expect(tarjeta.getByRole('link', { name: /^Abrir el PDF/ })).toHaveAttribute('target', '_blank')
})
