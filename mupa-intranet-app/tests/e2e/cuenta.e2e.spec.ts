/**
 * Menú de la cuenta de la barra superior (revisión de diseño, 26-oct-2026): «Cerrar sesión» ya no se pierde entre las demás
 * opciones. Está siempre en el mismo lugar (el botón con el nombre, arriba a la derecha), en escritorio y en teléfono,
 * y también a la vista en la barra de la gestión. Usa la misma función de salir que Configuración.
 */
import { expect, test, type Page } from '@playwright/test'

import { entrar } from './ayuda'

const botonCuenta = (page: Page) => page.getByRole('button', { name: /^Tu cuenta: / })
const menu = (page: Page) => page.locator('#cuenta-menu')

async function sinSesion(page: Page) {
  const r = await page.request.get('/api/auth/session')
  expect(await r.json()).toBeNull()
}

test('escritorio: «Cerrar sesión» está en el menú de la cuenta, con foco y Escape', async ({ page }) => {
  await entrar(page, 'admin')
  const boton = botonCuenta(page)
  await expect(boton).toBeVisible()
  await expect(boton).toHaveAttribute('aria-expanded', 'false')
  // Cerrado, no está en el árbol de accesibilidad: no se confunde con otras opciones.
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toHaveCount(0)

  await boton.click()
  await expect(boton).toHaveAttribute('aria-expanded', 'true')
  const salir = menu(page).getByRole('button', { name: 'Cerrar sesión', exact: true })
  await expect(salir).toBeVisible()
  // El foco pasa al panel al abrir (primer enlace).
  await expect(menu(page).getByRole('link', { name: 'Tu cuenta y configuración' })).toBeFocused()

  // Escape cierra y el foco vuelve al botón.
  await page.keyboard.press('Escape')
  await expect(menu(page)).toBeHidden()
  await expect(boton).toBeFocused()

  // Con teclado: Enter abre; Tab hasta «Cerrar sesión» y Enter la cierra.
  await page.keyboard.press('Enter')
  await expect(salir).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(salir).toBeFocused()
  // Tab fuera del panel lo cierra.
  await page.keyboard.press('Tab')
  await expect(menu(page)).toBeHidden()

  await boton.click()
  await salir.click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.locator('#topbar').getByRole('link', { name: 'Iniciar sesión' })).toBeVisible()
  await expect(botonCuenta(page)).toHaveCount(0)
  await sinSesion(page)
})

test('clic afuera cierra el menú y no cierra la sesión', async ({ page }) => {
  await entrar(page, 'prueba1')
  await botonCuenta(page).click()
  await expect(menu(page)).toBeVisible()
  await page.locator('#contenido, .app-content').first().click({ position: { x: 5, y: 5 } })
  await expect(menu(page)).toBeHidden()
  expect(await (await page.request.get('/api/auth/session')).json()).not.toBeNull()
})

test('teléfono (390 px): el botón y «Cerrar sesión» miden 44 px y caben en pantalla', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await entrar(page, 'prueba2')
  const boton = botonCuenta(page)
  const caja = (await boton.boundingBox())!
  expect(caja.width).toBeGreaterThanOrEqual(44)
  expect(caja.height).toBeGreaterThanOrEqual(44)
  await boton.click()
  const salir = menu(page).getByRole('button', { name: 'Cerrar sesión', exact: true })
  await expect(salir).toBeVisible()
  const s = (await salir.boundingBox())!
  expect(s.height).toBeGreaterThanOrEqual(44)
  expect(s.x).toBeGreaterThanOrEqual(0)
  expect(s.x + s.width).toBeLessThanOrEqual(390)
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  await salir.click()
  await expect(page.locator('#topbar').getByRole('link', { name: 'Iniciar sesión' })).toBeVisible()
  await sinSesion(page)
})

test('la gestión: «Cerrar sesión» a la vista en su barra, en escritorio y en teléfono', async ({ page }) => {
  await entrar(page, 'admin')
  await page.goto('/gestion')
  const salir = page.locator('.gx-barra').getByRole('button', { name: 'Cerrar sesión', exact: true })
  await expect(salir).toBeVisible()
  for (const ancho of [1440, 320]) {
    await page.setViewportSize({ width: ancho, height: 800 })
    const c = (await salir.boundingBox())!
    expect(c.height).toBeGreaterThanOrEqual(44)
    expect(c.x + c.width).toBeLessThanOrEqual(ancho)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  }
  await salir.click()
  await expect(page).toHaveURL(/\/$/)
  await sinSesion(page)
})

test('Configuración sigue teniendo su botón de cerrar sesión (misma función)', async ({ page }) => {
  await entrar(page, 'prueba1')
  await page.goto('/configuracion')
  await page.locator('main').getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/$/)
  await sinSesion(page)
})
