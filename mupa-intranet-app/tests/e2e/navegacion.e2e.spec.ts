/**
 * Menú del rediseño: 6 pestañas y la Clínica; el soporte técnico se abre desde
 * Aplicaciones y los grupos no se despliegan solos;
 * en el Inicio cada quien elige qué ver de los bloques con listas largas, el
 * Directorio lleva a búsquedas ya hechas y el panel de gestión se pliega.
 */
import { expect, test } from '@playwright/test'

import { entrar, reiniciarInicio } from './ayuda'

test.afterEach(async ({ request }) => {
  await reiniciarInicio(request, 'prueba1')
})

test('el menú tiene las pestañas del rediseño, Identidad visual y la Clínica; la Mesa de Servicios se abre desde Aplicaciones', async ({ page }) => {
  await page.goto('/')
  const menu = page.locator('#sidebar .app-nav')
  const pestanas = menu.locator(':scope > .app-navitem .lbl, :scope > .app-navgroup > .app-navgroup__row .lbl')
  await expect(pestanas).toHaveText(['Inicio', 'Asistente', 'Aplicaciones', 'Directorio', 'Documentos', 'Noticias', 'Identidad visual', 'Recursos Humanos', 'Clínica Municipal'])
  // Recursos Humanos es un destino sin submenú (la Clínica tiene el suyo).
  await expect(menu.locator('[data-group="rrhh"]')).toHaveCount(0)
  await expect(menu.getByRole('link', { name: 'Soporte técnico' })).toHaveCount(0)

  await menu.getByRole('link', { name: 'Aplicaciones', exact: true }).click()
  await page.getByLabel('Buscar aplicación').fill('mesa de servicios')
  await page.locator('.app-catalog .app-tile a[href="/mesa-servicios"]').click()
  await expect(page).toHaveURL(/\/mesa-servicios$/)
  await expect(page.locator('.crumbs a')).toHaveText(['Inicio', 'Aplicaciones'])
  await expect(menu.getByRole('link', { name: 'Aplicaciones', exact: true })).toHaveAttribute('aria-current', 'page')
})

test('los grupos del menú no se abren solos: la persona los abre con la flecha y queda recordado', async ({ page }) => {
  await page.goto('/clinica')
  const clinica = page.locator('#sidebar [data-group="clinica"]')
  const abrir = clinica.getByRole('button', { name: 'Mostrar secciones de Clínica Municipal' })
  await expect(abrir).toHaveAttribute('aria-expanded', 'false')
  await expect(clinica.getByRole('link', { name: 'Solicitar recetas' })).toBeHidden()
  // También en una página del grupo (el grupo se marca, pero sigue cerrado).
  await page.goto('/clinica-recetas')
  await expect(clinica).toHaveClass(/is-current/)
  await expect(clinica.locator('.app-navgroup__panel')).toBeHidden()

  await abrir.click()
  await expect(clinica.getByRole('link', { name: 'Solicitar recetas' })).toBeVisible()
  await page.reload()
  await expect(abrir).toHaveAttribute('aria-expanded', 'true')
  await abrir.click()
  await expect(clinica.getByRole('link', { name: 'Solicitar recetas' })).toBeHidden()
})

test('"Elegir qué mostrar": ocultar formularios queda guardado en la cuenta, y "Marcar todos" los vuelve', async ({ page }) => {
  await entrar(page, 'prueba1')
  const bloque = page.locator('.home-w[data-uid=formularios]')
  if (!(await bloque.count())) {
    // Por si el diseño por defecto no lo trae: se agrega desde la biblioteca.
    await page.goto('/?personalizar=1')
    await page.getByRole('button', { name: 'Agregar bloque' }).click()
    await page.getByRole('button', { name: 'Agregar Formularios de solicitud' }).click()
  } else {
    await page.goto('/?personalizar=1')
  }
  await page.getByRole('button', { name: 'Elegir qué mostrar en «Formularios de solicitud»' }).click()
  const dlg = page.getByRole('dialog', { name: /Elegir qué mostrar/ })
  await dlg.getByLabel('Solicitud de Carpetas Compartidas').uncheck()
  await dlg.getByLabel('Solicitud para Accesos a Páginas Web').uncheck()
  await dlg.getByRole('button', { name: 'Aplicar' }).click()
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.locator('.home-toast.is-on')).toContainText('se guardó')

  // Se vuelve a abrir el Inicio (sin ?personalizar): lo guardado viene de la cuenta.
  await page.goto('/')
  await expect(bloque.getByRole('link', { name: /Carpetas Compartidas/ })).toHaveCount(0)
  await expect(bloque.getByRole('link', { name: /Nuevos Funcionarios/ })).toBeVisible()
  await expect(bloque.locator('.home-ocultos')).toContainText('2 ocultos por ti')

  await bloque.getByRole('link', { name: 'Elegir qué mostrar' }).click()
  await page.getByRole('button', { name: 'Elegir qué mostrar en «Formularios de solicitud»' }).click()
  await dlg.getByRole('button', { name: 'Marcar todos' }).click()
  await dlg.getByRole('button', { name: 'Aplicar' }).click()
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.locator('.home-toast.is-on')).toContainText('se guardó')
  await page.goto('/')
  await expect(bloque.getByRole('link', { name: /Carpetas Compartidas/ })).toBeVisible()
  await expect(bloque.locator('.home-ocultos')).toHaveCount(0)
})

test('no se puede ocultar todo un bloque: pide dejar al menos uno', async ({ page }) => {
  await page.goto('/?personalizar=1')
  await page.getByRole('button', { name: 'Elegir qué mostrar en «Clínica Municipal»' }).click()
  const dlg = page.getByRole('dialog', { name: /Elegir qué mostrar/ })
  for (const c of await dlg.getByRole('checkbox').all()) await c.uncheck()
  await expect(dlg.getByRole('alert')).toContainText('Deja al menos uno marcado')
  await expect(dlg.getByRole('button', { name: 'Aplicar' })).toBeDisabled()
})

test('el Directorio del Inicio lleva a búsquedas ya hechas: por extensión y por dirección', async ({ page }) => {
  await page.goto('/')
  const bloque = page.locator('.home-w[data-uid=directorio]')
  const chip = bloque.locator('.dir-deps a').first()
  const direccion = (await chip.textContent())!.trim()
  await chip.click()
  await expect(page).toHaveURL(/\/directorio\?dir=/)
  await expect(page.getByLabel('Filtrar por dirección')).toHaveValue(direccion)
  await page.goBack()
  await bloque.locator('a.person-row').first().click()
  await expect(page).toHaveURL(/\/directorio\?q=\d+/)
  await expect(page.locator('table.ds-table tbody tr').first()).toBeVisible()
})

test('el panel de gestión empieza plegado, se despliega y lo recuerda', async ({ page }) => {
  await entrar(page, 'comunicacion')
  const panel = page.locator('.gest-panel')
  await expect(panel.locator('.gest-panel__grid')).toBeHidden()
  await panel.getByRole('button', { name: 'Mostrar' }).click()
  await expect(panel.locator('.gest-tile').first()).toBeVisible()
  await page.reload()
  await expect(panel.locator('.gest-tile').first()).toBeVisible()
  await panel.getByRole('button', { name: 'Ocultar' }).click()
  await expect(panel.locator('.gest-panel__grid')).toBeHidden()
  await page.reload()
  await expect(panel.locator('.gest-panel__grid')).toBeHidden()
  await panel.getByRole('button', { name: 'Mostrar' }).click()
  await expect(panel.locator('.gest-tile').first()).toBeVisible()
})
