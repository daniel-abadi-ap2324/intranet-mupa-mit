/**
 * Comunicación: boletines con su PDF, noticias y el contenido del Inicio. Cada
 * prueba deja los datos como estaban (borra lo que crea, restablece lo que cambia).
 */
import { expect, test } from '@playwright/test'

import { abrirPanel, entrar, vigilarErrores } from './ayuda'

const PDF = Buffer.from('%PDF-1.4\n1 0 obj << >> endobj\n%%EOF\n')

test('Comunicación sube un boletín con su PDF y se ve en Boletines; al borrarlo desaparece', async ({ page, request }) => {
  const errores = vigilarErrores(page)
  await entrar(page, 'comunicacion')
  await abrirPanel(page, 'Boletines')
  await expect(page.getByRole('heading', { level: 1, name: 'Boletines' })).toBeVisible()

  await page.getByRole('button', { name: 'Nuevo boletín' }).click()
  const dlg = page.getByRole('dialog', { name: 'Nuevo boletín' })
  await dlg.getByLabel('Fecha del boletín').fill('2031-01-15')
  await dlg.getByLabel('Subir PDF').setInputFiles({ name: 'Boletín de prueba.pdf', mimeType: 'application/pdf', buffer: PDF })
  await expect(dlg.getByText('Subido: Boletin-de-prueba.pdf')).toBeVisible()
  await expect(dlg.getByLabel('PDF', { exact: true })).toHaveValue(/^\/api\/files\/\d+\/Boletin-de-prueba\.pdf$/)
  const url = await dlg.getByLabel('PDF', { exact: true }).inputValue()
  await dlg.getByRole('button', { name: 'Guardar' }).click()
  await expect(dlg).toBeHidden()

  // El PDF se descarga y el boletín está en la página pública (el más nuevo, primero).
  expect((await request.get(url)).headers()['content-type']).toMatch(/^application\/pdf/)
  await page.goto('/boletines')
  await expect(page.locator('.bol-row').first().getByRole('link', { name: /Abrir el PDF del 15 ene 2031/ })).toHaveAttribute('href', url)

  expect(errores()).toEqual([])

  // Un archivo que no es PDF ni imagen se rechaza (el 400 de esa subida es esperado).
  await page.goto('/gestion/boletines')
  await page.getByRole('button', { name: 'Nuevo boletín' }).click()
  await page.getByRole('dialog', { name: 'Nuevo boletín' }).getByLabel('Subir PDF').setInputFiles({ name: 'truco.pdf', mimeType: 'application/pdf', buffer: Buffer.from('no soy un pdf') })
  await expect(page.getByRole('dialog', { name: 'Nuevo boletín' }).getByText('Solo se aceptan PDF e imágenes (JPG, PNG o WebP).')).toBeVisible()
  await page.getByRole('dialog', { name: 'Nuevo boletín' }).getByRole('button', { name: 'Cancelar' }).click()

  await page.getByRole('button', { name: 'Eliminar «Boletín del 15 ene 2031»' }).click()
  await page.getByRole('dialog', { name: 'Eliminar' }).getByRole('button', { name: 'Eliminar' }).click()
  await expect(page.getByRole('row', { name: /15 ene 2031/ })).toHaveCount(0)
  await page.goto('/boletines')
  await expect(page.getByRole('link', { name: /Abrir el PDF del 15 ene 2031/ })).toHaveCount(0)
})

test('una noticia en borrador no se ve; publicada sale en Noticias y en el Inicio', async ({ page }) => {
  const titulo = 'Noticia de prueba ' + Date.now()
  await entrar(page, 'comunicacion')
  await page.goto('/gestion/noticias')
  await page.getByRole('button', { name: 'Nueva noticia' }).click()
  const dlg = page.getByRole('dialog', { name: 'Nueva noticia' })
  await dlg.getByLabel('Título').fill(titulo)
  await dlg.getByLabel('Resumen (opcional)').fill('Texto corto de la noticia.')
  await dlg.getByLabel('Fecha').fill('2031-01-15')
  await dlg.getByRole('button', { name: 'Guardar como borrador' }).click()
  await expect(dlg).toBeHidden()
  await page.goto('/noticias')
  await expect(page.getByText(titulo)).toHaveCount(0)

  await page.goto('/gestion/noticias')
  await page.getByRole('button', { name: `Publicar «${titulo}»` }).click()
  await expect(page.getByRole('row', { name: new RegExp(titulo) })).toContainText('Publicada')
  await page.goto('/noticias')
  await expect(page.getByText(titulo)).toBeVisible()
  await page.goto('/')
  await expect(page.locator('.panel', { hasText: 'Noticias y comunicados' }).getByText(titulo)).toBeVisible()

  await page.goto('/gestion/noticias')
  await page.getByRole('button', { name: `Eliminar «${titulo}»` }).click()
  await page.getByRole('dialog', { name: 'Eliminar' }).getByRole('button', { name: 'Eliminar' }).click()
  await expect(page.getByRole('row', { name: new RegExp(titulo) })).toHaveCount(0)
})

test('Comunicación edita el contenido del Inicio: un enlace con IP no se guarda', async ({ page }) => {
  await entrar(page, 'comunicacion')
  await page.goto('/gestion/inicio')
  // Abre en los enlaces institucionales (la bienvenida ya no existe: el Inicio no lleva descripción).
  await expect(page.getByRole('button', { name: 'Guardar «Enlaces institucionales»' })).toBeVisible()
  await page.getByRole('button', { name: 'Agregar fila' }).click()
  const ultima = page.locator('.gest-fila').last()
  await ultima.getByLabel('Título').fill('Con IP')
  await ultima.getByLabel('Enlace').fill('http://10.0.0.1')
  await page.getByRole('button', { name: 'Guardar «Enlaces institucionales»' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Revisa estos datos' })).toContainText('No se permiten direcciones IP')
})

test('un usuario no entra a los paneles de Comunicación', async ({ page }) => {
  await entrar(page, 'prueba1')
  for (const ruta of ['/gestion/noticias', '/gestion/boletines', '/gestion/videos', '/gestion/inicio']) {
    await page.goto(ruta)
    await expect(page.getByText('No tienes permiso para usar esta sección.'), ruta).toBeVisible()
  }
})
