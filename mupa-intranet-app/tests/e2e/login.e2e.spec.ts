/** Login simple: dice con qué cuenta se entra, ayuda con los errores y vuelve a donde estaba la persona. */
import { expect, test } from '@playwright/test'

import { CUENTAS, entrar } from './ayuda'

const clave = (page: import('@playwright/test').Page) => page.getByLabel('Contraseña', { exact: true })

test('explica con qué cuenta se entra, sin menú, y ayuda si olvidaste la contraseña', async ({ page }) => {
  await page.goto('/entrar')
  await expect(page.getByRole('heading', { level: 1, name: 'Entra a la intranet' })).toBeVisible()
  // Una sola tarjeta con tres caminos: Entrar, Crear cuenta y Entrar sin cuenta. Sin textos largos.
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute('href', '/registro')
  await expect(page.getByRole('link', { name: 'Entrar sin cuenta' })).toBeVisible()
  await expect(page.getByText('Al entrar puedes')).toHaveCount(0)
  await expect(page.locator('details')).toHaveCount(0)
  await expect(page.getByLabel('Cédula o correo')).toBeFocused()
  await expect(page.locator('#sidebar')).toHaveCount(0)
  await expect(page.locator('#topbar')).toHaveCount(0)

  await expect(page.locator('.login__olvido')).toContainText('¿Olvidaste tu contraseña? Llama a la Mesa de Servicios, ext. 1400.')

  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  // Teléfono: botones de al menos 44 px, uno bajo el otro.
  for (const nombre of ['Crear cuenta', 'Entrar sin cuenta']) {
    const caja = await page.getByRole('link', { name: nombre }).boundingBox()
    expect(caja!.height).toBeGreaterThanOrEqual(44)
  }

  await page.getByRole('link', { name: 'Entrar sin cuenta' }).click()
  await expect(page).toHaveURL(/\/$/)
})

test('dice qué falta al lado de cada campo', async ({ page }) => {
  await page.goto('/entrar')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByText('Escribe tu cédula o tu correo.')).toBeVisible()
  await expect(page.getByText('Escribe tu contraseña.')).toBeVisible()
  await expect(page.getByLabel('Cédula o correo')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByLabel('Cédula o correo')).toBeFocused()
})

test('con datos malos: mensaje claro, borra la contraseña y vuelve a ella', async ({ page }) => {
  await page.goto('/entrar')
  await page.getByLabel('Cédula o correo').fill('nadie@ejemplo.test')
  await clave(page).fill('no-es-esta')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('alert')).toContainText('no son correctos')
  await expect(clave(page)).toHaveValue('')
  await expect(clave(page)).toBeFocused()
})

test('Mostrar / Ocultar la contraseña y aviso de mayúsculas', async ({ page }) => {
  await page.goto('/entrar')
  await clave(page).fill('secreta')
  await expect(clave(page)).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: 'Mostrar' }).click()
  await expect(clave(page)).toHaveAttribute('type', 'text')
  await expect(page.getByRole('button', { name: 'Ocultar' })).toHaveAttribute('aria-pressed', 'true')

  await clave(page).dispatchEvent('keydown', { key: 'A', modifierCapsLock: true })
  await expect(page.getByText('Tienes activadas las mayúsculas')).toBeVisible()
  await clave(page).dispatchEvent('keydown', { key: 'a', modifierCapsLock: false })
  await expect(page.getByText('Tienes activadas las mayúsculas')).toHaveCount(0)
})

test('si el servidor responde algo raro (502 con HTML), no muestra texto técnico', async ({ page }) => {
  await page.route('**/api/auth/login', (r) => r.fulfill({ status: 502, contentType: 'text/html', body: '<html><body>502 Bad Gateway</body></html>' }))
  await page.goto('/entrar')
  await page.getByLabel('Cédula o correo').fill(CUENTAS.prueba1)
  await clave(page).fill('password')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('alert')).toContainText('No se pudo conectar con la intranet')
  await expect(page.getByRole('alert')).not.toContainText('HTTP')
})

test('vuelve a la página de donde vino', async ({ page }) => {
  await page.goto('/mis-solicitudes')
  await page.locator('#contenido').getByRole('link', { name: 'Iniciar sesión' }).click()
  await expect(page).toHaveURL(/\/entrar$/)
  await page.getByLabel('Cédula o correo').fill(CUENTAS.prueba1)
  await clave(page).fill('password')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/mis-solicitudes$/)
})

test('con la sesión iniciada, /entrar lo dice y ofrece ir al inicio', async ({ page }) => {
  await entrar(page, 'prueba1')
  await page.goto('/entrar')
  await expect(page.getByRole('heading', { level: 1, name: 'Ya iniciaste sesión' })).toBeVisible()
  await expect(page.locator('.login__card')).toContainText('Lucía Herrera')
  await page.getByRole('link', { name: 'Ir al inicio' }).click()
  await expect(page).toHaveURL(/\/$/)
})
