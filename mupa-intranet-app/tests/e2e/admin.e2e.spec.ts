/**
 * Administración: departamentos, personas y aplicaciones limitadas a un
 * departamento. Crea sus propios datos con nombres únicos y los borra al final.
 */
import { expect, test, type Page } from '@playwright/test'

import { abrirPanel, entrar, panelGestion, paneles, vigilarErrores } from './ayuda'

const catalogoTiene = async (page: Page, nombre: string) => {
  await page.goto('/aplicaciones')
  await expect(page.locator('section:has(#catalog-title) .app-tile').first()).toBeVisible()
  await page.getByLabel('Buscar aplicación').fill(nombre)
  await expect(page.locator('.count-note')).toBeVisible()
  return (await page.locator('section:has(#catalog-title) .app-tile', { hasText: nombre }).count()) > 0
}

test('Admin crea un departamento, se lo asigna a una persona y limita una aplicación a ese departamento', async ({ page, browser }) => {
  const errores = vigilarErrores(page)
  const sufijo = String(Date.now()).slice(-6)
  const depto = 'Depto de prueba ' + sufijo
  const app = 'App restringida ' + sufijo

  await entrar(page, 'admin')

  // Departamento nuevo.
  await abrirPanel(page, 'Departamentos')
  await expect(page.getByRole('heading', { level: 1, name: 'Departamentos' })).toBeVisible()
  await page.getByRole('button', { name: 'Nuevo departamento' }).click()
  const dlgDep = page.getByRole('dialog', { name: 'Nuevo departamento' })
  await dlgDep.getByRole('button', { name: 'Guardar' }).click()
  await expect(dlgDep.getByText('Escribe el nombre del departamento.')).toBeVisible()
  await dlgDep.getByLabel('Nombre').fill(depto)
  await dlgDep.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('row', { name: new RegExp(depto) })).toBeVisible()

  // Se lo asigna a sindepto.
  await page.goto('/gestion/usuarios')
  await page.getByLabel('Buscar persona').fill('sindepto@')
  const fila = page.getByRole('row', { name: /sindepto@ejemplo\.test/ })
  await expect(fila).toBeVisible()
  await fila.getByRole('button', { name: /Cambiar el departamento/ }).click()
  const dlgUsr = page.getByRole('dialog', { name: /Departamento de/ })
  await dlgUsr.getByLabel('Departamento').selectOption({ label: depto })
  await dlgUsr.getByRole('button', { name: 'Guardar' }).click()
  await expect(fila).toContainText(depto)

  // Aplicación limitada a ese departamento.
  await page.goto('/gestion/aplicaciones')
  await page.getByRole('button', { name: 'Nueva aplicación' }).click()
  const dlgApp = page.getByRole('dialog', { name: 'Nueva aplicación' })
  await dlgApp.getByLabel('Nombre').fill(app)
  await dlgApp.getByLabel('Descripción').fill('Solo para pruebas.')
  await dlgApp.getByLabel('Dirección (opcional)').fill('https://restringida-' + sufijo + '.ejemplo.gob.pa')
  await dlgApp.getByLabel('Buscar departamento').fill(sufijo)
  await dlgApp.getByRole('checkbox', { name: depto }).check()
  await dlgApp.getByRole('checkbox', { name: /Publicada/ }).check()
  await dlgApp.getByRole('button', { name: 'Guardar' }).click()
  await expect(dlgApp).toBeHidden()
  await page.getByLabel('Buscar aplicación').fill(app)
  await expect(page.getByRole('row', { name: new RegExp(app) })).toContainText(depto)

  // El filtro "Visible para" la muestra para ese departamento.
  await page.getByLabel('Visible para').selectOption({ label: depto })
  await expect(page.getByRole('row', { name: new RegExp(app) })).toBeVisible()

  // sindepto (de ese departamento) la ve; prueba1 no.
  const otra = await browser.newPage()
  await entrar(otra, 'sindepto')
  expect(await catalogoTiene(otra, app)).toBe(true)
  await otra.context().clearCookies()
  await entrar(otra, 'prueba1')
  expect(await catalogoTiene(otra, app)).toBe(false)
  await otra.close()

  // Limpieza: sin la app ni la persona, el departamento se puede borrar.
  await page.getByLabel('Visible para').selectOption({ label: 'Todo el catálogo' })
  await page.getByRole('button', { name: `Eliminar «${app}»` }).click()
  await page.getByRole('dialog', { name: 'Eliminar aplicación' }).getByRole('button', { name: 'Eliminar' }).click()
  await expect(page.getByRole('row', { name: new RegExp(app) })).toHaveCount(0)

  await page.goto('/gestion/usuarios?q=sindepto%40')
  await page.getByRole('row', { name: /sindepto@ejemplo\.test/ }).getByRole('button', { name: /Cambiar el departamento/ }).click()
  await page.getByRole('dialog', { name: /Departamento de/ }).getByLabel('Departamento').selectOption({ label: 'Sin departamento' })
  await page.getByRole('dialog', { name: /Departamento de/ }).getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('row', { name: /sindepto@ejemplo\.test/ })).toContainText('Sin departamento')

  await page.goto('/gestion/departamentos')
  await page.getByLabel('Buscar departamento').fill(sufijo)
  await page.getByRole('button', { name: `Eliminar «${depto}»` }).click()
  await page.getByRole('dialog', { name: 'Eliminar departamento' }).getByRole('button', { name: 'Eliminar' }).click()
  await expect(page.getByRole('row', { name: new RegExp(depto) })).toHaveCount(0)
  expect(errores()).toEqual([])
})

test('Admin abre la ficha de una persona: todos sus datos menos la contraseña', async ({ page }) => {
  const errores = vigilarErrores(page)
  await entrar(page, 'admin')
  await page.goto('/gestion/usuarios?q=sindepto%40')
  await page.getByRole('row', { name: /sindepto@ejemplo\.test/ }).getByRole('button', { name: /Ver la ficha de/ }).click()
  const ficha = page.getByRole('dialog', { name: /Ficha de/ })
  // Cuenta de prueba: sin cédula ni RH Link, pero con el resto de sus datos.
  await expect(ficha.getByText('Cuenta de prueba (sin cédula)')).toBeVisible()
  await expect(ficha).toContainText('sindepto@ejemplo.test')
  await expect(ficha).toContainText('Sesiones abiertas')
  await expect(ficha).toContainText('Según RH Link')
  await expect(ficha).not.toContainText(/contraseña/i)
  await ficha.getByRole('button', { name: 'Cerrar' }).last().click()
  await expect(ficha).toBeHidden()
  expect(errores()).toEqual([])
})

test('quien no es admin no ve los paneles de administración', async ({ page }) => {
  await entrar(page, 'comunicacion')
  // En su Centro de Gestión no aparecen las pantallas de administración (y el menú lateral no lleva ninguna).
  await page.goto('/gestion?area=comunicacion')
  await expect(paneles(page).getByRole('link', { name: 'Anuncios', exact: true })).toBeVisible()
  await expect(paneles(page).getByRole('link', { name: 'Boletines', exact: true })).toBeVisible()
  await expect(paneles(page).getByRole('link', { name: /^(Usuarios|Departamentos|Catálogo)/ })).toHaveCount(0)
  await page.goto('/')
  await expect(page.locator('#sidebar a[href^="/gestion/"]')).toHaveCount(0)
  for (const ruta of ['/gestion/usuarios', '/gestion/departamentos', '/gestion/aplicaciones']) {
    await page.goto(ruta)
    await expect(page.getByText('No tienes permiso para usar esta sección.'), ruta).toBeVisible()
  }
})

test('cada rol ve su panel de gestión en el Inicio y en el menú; un usuario no', async ({ page }) => {
  await entrar(page, 'admin')
  const panel = await panelGestion(page)
  await expect(panel.getByRole('link', { name: /Usuarios/ })).toBeVisible()
  // En el menú lateral, la gestión es una sola entrada: el Centro de Gestión.
  await expect(page.locator('#sidebar a[href^="/gestion"]')).toHaveCount(1)
  await expect(page.locator('#sidebar').getByRole('link', { name: 'Centro de Gestión' })).toBeVisible()
  await panel.getByRole('link', { name: /Departamentos/ }).click()
  await expect(page).toHaveURL(/\/gestion\/departamentos$/)

  await page.context().clearCookies()
  await entrar(page, 'comunicacion')
  const panelCom = await panelGestion(page)
  await expect(panelCom.getByRole('link', { name: /Anuncios/ })).toBeVisible()
  await expect(panelCom.getByRole('link', { name: /Usuarios/ })).toHaveCount(0)

  await page.context().clearCookies()
  await entrar(page, 'prueba1')
  await expect(page.getByRole('region', { name: 'Tu panel de gestión' })).toHaveCount(0)
  await expect(page.locator('#sidebar a[href^="/gestion"]')).toHaveCount(0)
})
