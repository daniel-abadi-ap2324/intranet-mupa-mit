/**
 * Anuncios: Comunicación los publica desde /gestion/anuncios; quien no tiene el rol no ve el panel.
 * Hoy el bloque «Anuncios institucionales» no va en el Inicio (está en pausa: lib/bloques.ts, `pausa`),
 * así que lo publicado no se ve ahí.
 */
import { expect, test } from '@playwright/test'

import { abrirPanel, entrar, reiniciarInicio, vigilarErrores } from './ayuda'

test('Comunicación publica un anuncio y lo retira; el Inicio no lo muestra (el bloque está en pausa)', async ({ page }) => {
  const errores = vigilarErrores(page)
  const titulo = 'Anuncio de prueba ' + Date.now()
  const fila = () => page.getByRole('row', { name: new RegExp(titulo) })

  await entrar(page, 'comunicacion')
  await abrirPanel(page, 'Anuncios')
  await expect(page).toHaveURL(/\/gestion\/anuncios$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Anuncios del Inicio' })).toBeVisible()

  await page.getByRole('button', { name: 'Nuevo anuncio' }).click()
  const dlg = page.getByRole('dialog', { name: 'Nuevo anuncio' })
  // Se avisa en cada campo antes de enviar.
  await dlg.getByRole('button', { name: 'Publicar' }).click()
  await expect(dlg.getByText('Escribe el título del anuncio.')).toBeVisible()
  await dlg.getByLabel('Título').fill(titulo)
  await dlg.getByLabel('Detalle (opcional)').fill('Sábado de 8 a 10 p.m.')
  await dlg.getByLabel('Nivel').selectOption('urgente')
  await dlg.getByLabel('Enlace (opcional)').fill('https://192.0.2.10/app')
  await dlg.getByRole('button', { name: 'Publicar' }).click()
  await expect(dlg.getByText(/No se permiten direcciones IP/)).toBeVisible()
  await dlg.getByLabel('Enlace (opcional)').fill('/mesa-servicios')
  await expect(dlg.locator('.ann-previa')).toContainText(titulo)
  await dlg.getByRole('button', { name: 'Publicar' }).click()
  await expect(dlg).toBeHidden()
  await expect(fila()).toContainText('Vigente')
  await expect(fila()).toContainText('Urgente')

  // Editar uno publicado no lo pasa a borrador: no hay "Guardar borrador" y sigue vigente.
  await page.getByRole('button', { name: `Editar «${titulo}»` }).click()
  const editor = page.getByRole('dialog', { name: 'Editar anuncio' })
  await expect(editor.getByRole('button', { name: 'Guardar borrador' })).toHaveCount(0)
  await editor.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(editor).toBeHidden()
  await expect(fila()).toContainText('Vigente')

  // El Inicio por defecto no trae el bloque de anuncios: no aparece.
  await page.context().clearCookies()
  await page.goto('/')
  await expect(page.locator('#homeGrid > .home-w').first()).toBeVisible()
  await expect(page.locator('.ann', { hasText: titulo })).toHaveCount(0)

  // Retirado: sale del Inicio, pero sigue en el panel.
  await entrar(page, 'comunicacion')
  await page.goto('/gestion/anuncios')
  await page.getByRole('button', { name: `Retirar «${titulo}»` }).click()
  await expect(fila()).toContainText('Retirado')
  await page.goto('/')
  await expect(page.locator('#homeGrid > .home-w').first()).toBeVisible()
  await expect(page.locator('.ann', { hasText: titulo })).toHaveCount(0)

  // Eliminado (deja la base como estaba).
  await page.goto('/gestion/anuncios')
  await page.getByRole('button', { name: `Eliminar «${titulo}»` }).click()
  await page.getByRole('dialog', { name: 'Eliminar anuncio' }).getByRole('button', { name: 'Eliminar' }).click()
  await expect(fila()).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Nuevo anuncio' })).toBeFocused()
  expect(errores()).toEqual([])
})

test('sin el rol no hay menú de gestión ni acceso al panel', async ({ page, request }) => {
  await page.goto('/gestion/anuncios')
  await expect(page.getByText('Inicia sesión para gestionar los anuncios.')).toBeVisible()

  await reiniciarInicio(request, 'prueba1')
  await entrar(page, 'prueba1')
  await expect(page.locator('#sidebar a[href^="/gestion"]')).toHaveCount(0)
  await expect(page.locator('.panel', { hasText: 'Anuncios institucionales' })).toHaveCount(0)
  await page.goto('/gestion/anuncios')
  await expect(page.getByText('No tienes permiso para gestionar anuncios.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Nuevo anuncio' })).toHaveCount(0)
})

test('si la sesión vence a medio uso, se avisa y se ofrece volver a entrar', async ({ page }) => {
  await entrar(page, 'comunicacion')
  await page.goto('/gestion/anuncios')
  await page.getByRole('button', { name: 'Nuevo anuncio' }).click()
  const dlg = page.getByRole('dialog', { name: 'Nuevo anuncio' })
  await dlg.getByLabel('Título').fill('No debería guardarse')
  // La sesión desaparece (vence o se cierra en otra pestaña) mientras se llena el formulario.
  await page.context().clearCookies()
  await dlg.getByRole('button', { name: 'Guardar borrador' }).click()

  const aviso = page.getByRole('alert').filter({ hasText: 'Tu sesión venció' })
  await expect(aviso).toBeVisible()
  await expect(page.getByText('Inicia sesión para gestionar los anuncios.')).toBeVisible()
  await aviso.getByRole('link', { name: 'Vuelve a iniciar sesión' }).click()
  await expect(page).toHaveURL(/\/entrar$/)
})
