/** Mesa de Servicios: solicitar en línea, video en 3 partes, contacto y extensiones. */
import { expect, test } from '@playwright/test'

import { vigilarErrores } from './ayuda'

test('se organiza en solicitar, video en 3 partes y contacto, sin plazos inventados', async ({ page }) => {
  const errores = vigilarErrores(page)
  await page.goto('/mesa-servicios')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mesa de Servicios')
  await expect(page.locator('main')).toContainText('Solicitudes, guías y contacto de soporte técnico.')
  await expect(page.locator('main')).not.toContainText('día hábil')

  const solicitar = page.getByRole('region', { name: 'Solicitar en línea' })
  await expect(solicitar.getByRole('link', { name: /Código de llamadas/ })).toHaveAttribute('href', /pinrequests/)
  await expect(solicitar.getByRole('link', { name: /Acceso a la red WIFI/ })).toBeVisible()
  await expect(solicitar.getByRole('link', { name: 'mesadeayuda@pty.gob.pa' })).toHaveAttribute('href', 'mailto:mesadeayuda@pty.gob.pa')
  await expect(solicitar).toContainText('ext. 1400')

  // Video en 3 partes: la activa se marca y reproducir abre ese video en otra pestaña.
  const video = page.locator('#videos')
  await expect(video.getByRole('heading', { name: 'Restablecer usuario de máquina' })).toBeVisible()
  const partes = video.getByRole('list', { name: 'Partes del video' }).getByRole('button')
  await expect(partes).toHaveCount(3)
  // Cada parte tiene su propio título y su duración real.
  await expect(partes.nth(0)).toContainText('Iniciar sesión como administrador · 1:10')
  await expect(partes.nth(1)).toContainText('Restablecer la contraseña · 1:01')
  await expect(partes.nth(2)).toContainText('Verificar el acceso · 0:54')
  await expect(partes.nth(0)).toHaveAttribute('aria-current', 'true')
  await partes.nth(1).click()
  await expect(partes.nth(1)).toHaveAttribute('aria-current', 'true')
  await expect(partes.nth(0)).not.toHaveAttribute('aria-current', 'true')
  const reproducir = video.getByRole('link', { name: /Reproducir parte 2/ })
  await expect(reproducir).toHaveAttribute('href', '/sitio/2024/08/parte2.mp4')
  await expect(reproducir).toHaveAttribute('target', '_blank')
  await expect(reproducir).toHaveAttribute('rel', /noopener/)

  await expect(page.getByRole('link', { name: /Manuales/ })).toHaveAttribute('href', '/manuales')
  await expect(page.getByRole('link', { name: /Soporte ISTMO/ })).toHaveAttribute('href', '/sap-istmo')

  const lado = page.getByRole('region', { name: /Mesa de ayuda/ })
  await expect(lado).toContainText('1400')
  await expect(lado.getByRole('link', { name: 'mesadeayuda@pty.gob.pa' })).toBeVisible()
  const ext = page.getByRole('region', { name: 'Otras extensiones' })
  for (const [t, n] of [['Recepción', '1600'], ['Telefonía', '1614'], ['Cuarto de Servidores', '1621'], ['Administración DTI', '1657'], ['Desarrollo', '1670']]) {
    await expect(ext).toContainText(t)
    await expect(ext).toContainText(n)
  }
  expect(errores()).toEqual([])
})

test('el ancla #videos baja al video', async ({ page }) => {
  await page.goto('/mesa-servicios#videos')
  await expect(page.locator('#videos')).toBeInViewport()
})

test('en el teléfono no se desplaza a lo ancho y los controles miden 44 px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/mesa-servicios')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  for (const b of await page.locator('.msv-parte').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
})

test('alineada: la columna lateral arranca con las primeras tarjetas y llega al borde derecho de la cabecera', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/mesa-servicios')
  await expect(page.locator('.msv-sol').first()).toBeVisible()
  const caja = async (sel: string) => (await page.locator(sel).first().boundingBox())!
  const tarjeta = await caja('.msv-sol')
  const contacto = await caja('.msv-contacto')
  expect(Math.abs(contacto.y - tarjeta.y)).toBeLessThanOrEqual(1)
  const cabecera = await caja('.crumbs')
  const lado = await caja('.msv-lado')
  expect(Math.abs(lado.x + lado.width - (cabecera.x + cabecera.width))).toBeLessThanOrEqual(1)
  // Las tarjetas de una misma fila miden lo mismo.
  const alturas = await page.locator('.msv-sol').evaluateAll((l) => l.slice(0, 2).map((e) => Math.round(e.getBoundingClientRect().height)))
  expect(alturas[0]).toBe(alturas[1])
})
