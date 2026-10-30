/** Inicio modular: arrastrar, guardar en la cuenta, Deshacer, teclado y "Guardar para todos". */
import { expect, test } from '@playwright/test'

import { api, arrastrar, entrar, ordenInicio, reiniciarInicio } from './ayuda'

test.afterEach(async ({ request }) => {
  await reiniciarInicio(request, 'prueba1')
  await reiniciarInicio(request, 'prueba2')
})

test('sin sesión el orden se guarda en el navegador', async ({ page }) => {
  await page.goto('/')
  await arrastrar(page, 'mesa', 'directorio')
  await expect(page.locator('.home-toast.is-on')).toContainText('Deshacer')
  const orden = await ordenInicio(page)
  expect(orden.indexOf('mesa')).toBeLessThan(orden.indexOf('directorio'))
  expect(await page.evaluate(() => localStorage.getItem('mupa_inicio'))).toContain('mesa')
  await page.reload()
  expect(await ordenInicio(page)).toEqual(orden)
})

test('con sesión se guarda en la cuenta, se puede deshacer y no afecta a otra persona', async ({ page, browser, baseURL }) => {
  await entrar(page, 'prueba1')
  await expect(page.locator('.hero h1')).toContainText('Lucía')
  const antes = await ordenInicio(page)

  await arrastrar(page, 'mesa', 'directorio')
  await expect(page.locator('.home-toast.is-on')).toContainText('Deshacer')
  const despues = await ordenInicio(page)
  expect(despues).not.toEqual(antes)
  expect(await page.evaluate(() => localStorage.getItem('mupa_inicio'))).toBeNull()

  // Persiste al recargar (viene de la cuenta, no del navegador).
  await page.reload()
  expect(await ordenInicio(page)).toEqual(despues)

  // La otra cuenta, en otro navegador, sigue con el diseño de todos.
  const otro = await browser.newContext({ baseURL })
  const p2 = await otro.newPage()
  await entrar(p2, 'prueba2')
  await expect(p2.locator('.hero h1')).toContainText('Tomás')
  expect(await ordenInicio(p2)).toEqual(antes)
  await otro.close()

  // Deshacer vuelve al orden anterior.
  await arrastrar(page, 'directorio', 'mesa')
  await page.locator('.home-toast.is-on').getByRole('button', { name: 'Deshacer' }).click()
  await expect.poll(() => ordenInicio(page)).toEqual(despues)
})

test('se reordena con el teclado (Espacio, flecha, Espacio)', async ({ page }) => {
  await page.goto('/')
  const antes = await ordenInicio(page)
  const i = antes.indexOf('noticias')
  await page.locator('.home-w[data-uid=noticias] .home-w__grip').focus()
  for (const k of ['Space', 'ArrowLeft', 'Space']) {
    await page.keyboard.press(k)
    await page.waitForTimeout(400)
  }
  await expect.poll(async () => (await ordenInicio(page)).indexOf('noticias')).toBe(i - 1)
  await expect(page.locator('[aria-live]').filter({ hasText: /Se soltó/ }).first()).toBeAttached()
})

test('Personalizar: quitar, cambiar tamaño y agregar', async ({ page }) => {
  await entrar(page, 'prueba1')
  await page.goto('/?personalizar=1')
  await expect(page.locator('.home-w__body[inert]').first()).toBeAttached()
  page.on('dialog', (d) => d.accept())
  await page.locator('.home-w[data-uid=mesa] [data-act=quitar]').click()
  await expect(page.locator('.home-w[data-uid=mesa]')).toHaveCount(0)
  const tamano = page.locator('.home-w[data-uid=noticias] .home-w__size')
  await tamano.selectOption('completa')
  await expect(page.locator('.home-w[data-uid=noticias]')).toHaveAttribute('data-ancho', 'completa')
  await page.getByRole('button', { name: 'Agregar bloque' }).click()
  // Formularios: bloque de una sola copia y sin configuración (no abre otro diálogo). Clínica ya viene por defecto.
  await page.locator('dialog[open] [data-add=formularios]').click()
  await expect(page.locator('.home-w[data-widget=formularios]')).toHaveCount(1)
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.locator('.home-toast.is-on')).toContainText('Tu inicio se guardó en tu cuenta')
  // Queda guardado en la cuenta.
  await page.goto('/')
  await expect(page.locator('.home-w[data-uid=noticias]')).toHaveAttribute('data-ancho', 'completa')
  await expect(page.locator('.home-w[data-uid=mesa]')).toHaveCount(0)
  await expect(page.locator('.home-w[data-widget=formularios]')).toHaveCount(1)
})

test('administración cambia el Inicio de todos con "Guardar para todos"', async ({ page, request, browser, baseURL }) => {
  const admin = await api(request, 'admin')
  try {
    await entrar(page, 'admin')
    await page.goto('/?personalizar=1')
    page.on('dialog', (d) => d.accept())
    await page.locator('.home-w[data-uid=mesa] [data-act=quitar]').click()
    await page.getByRole('button', { name: 'Guardar para todos' }).click()
    await expect(page.locator('.home-toast.is-on')).toContainText('Diseño por defecto actualizado para todos')

    // Quien no ha personalizado (aquí, sin sesión) ya no ve ese bloque.
    const anon = await browser.newContext({ baseURL })
    const p = await anon.newPage()
    await p.goto('/')
    await expect(p.locator('#homeGrid > .home-w:not([data-uid=buscador])')).toHaveCount(8)
    await expect(p.locator('.home-w[data-uid=mesa]')).toHaveCount(0)
    await anon.close()
  } finally {
    await admin.put('/api/home/default-layout', { layout: null })
    await admin.put('/api/home/layout', { layout: null })
  }
})

test('Anuncios no va en el Inicio por defecto y, si alguien lo agrega, el bloque dice que no está funcionando; Mis solicitudes sí va', async ({ page, request }) => {
  await reiniciarInicio(request, 'prueba1')
  await entrar(page, 'prueba1')
  await expect(page.locator('.home-w[data-uid=anuncios]')).toHaveCount(0)
  await expect(page.locator('.home-w[data-uid=solicitudes]')).toHaveCount(1)

  try {
    await page.goto('/?personalizar=1')
    await page.getByRole('button', { name: 'Agregar bloque' }).click()
    const biblio = page.locator('dialog[open]')
    await expect(biblio.locator('.home-lib__item', { hasText: 'Anuncios institucionales' })).toContainText('No está funcionando por ahora')
    await biblio.locator('[data-add=anuncios]').click()
    const anuncios = page.locator('.home-w[data-uid=anuncios]')
    await expect(anuncios).toContainText('no está funcionando por ahora')
    await expect(anuncios).not.toContainText('No hay anuncios vigentes')
  } finally {
    await reiniciarInicio(request, 'prueba1')
  }
})
