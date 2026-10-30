/**
 * Administración: clasificar en bloque qué direcciones ven qué aplicaciones
 * (/gestion/aplicaciones, vista «Visibilidad»). Crea sus propias aplicaciones con
 * nombres únicos y las borra al final.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import { entrar, vigilarErrores } from './ayuda'

type Dep = { id: number; name: string }

const catalogoTiene = async (page: Page, nombre: string) => {
  await page.goto('/aplicaciones')
  await expect(page.locator('section:has(#catalog-title) .app-tile').first()).toBeVisible()
  await page.getByLabel('Buscar aplicación').fill(nombre)
  await expect(page.locator('.count-note')).toBeVisible()
  return (await page.locator('section:has(#catalog-title) .app-tile', { hasText: nombre }).count()) > 0
}

const crearApp = async (request: APIRequestContext, nombre: string, extra: Record<string, unknown> = {}) => {
  const r = await request.post('/api/applications', {
    data: { name: nombre, description: 'Solo para pruebas.', url: 'https://' + nombre.toLowerCase().replace(/[^a-z0-9]/g, '-') + '.ejemplo.gob.pa', area: 'Soporte', icon: '▦', published: true, ...extra },
  })
  expect(r.ok()).toBeTruthy()
  return (await r.json()) as { id: number }
}
const deptosDe = async (request: APIRequestContext, id: number) => ((await (await request.get('/api/applications/' + id)).json()).departments as Dep[]).map((d) => d.id)

const sinGuardar = (page: Page) => page.getByRole('region', { name: 'Cambios sin guardar' })

test('Admin clasifica aplicaciones por aplicación y por dirección, guarda y otra cuenta lo ve reflejado', async ({ page, browser }) => {
  test.setTimeout(180_000)
  const errores = vigilarErrores(page)
  const sufijo = String(Date.now()).slice(-6)
  const nombreA = 'Vis A ' + sufijo
  const nombreB = 'Vis B ' + sufijo
  const nombreBorrador = 'Vis Borrador ' + sufijo
  await entrar(page, 'admin')
  const api = page.request
  const a = await crearApp(api, nombreA)
  const b = await crearApp(api, nombreB)
  const borrador = await crearApp(api, nombreBorrador, { published: false })

  try {
    // El departamento de prueba1 y otro cualquiera.
    const deps = (await (await api.get('/api/departments')).json()) as Dep[]
    const personas = (await (await api.get('/api/users')).json()) as { email: string; departmentId: number | null }[]
    const depP1 = deps.find((d) => d.id === personas.find((p) => p.email === 'prueba1@ejemplo.test')?.departmentId)!
    expect(depP1).toBeTruthy()
    const otro = deps.find((d) => d.id !== depP1.id)!

    await page.goto('/gestion/aplicaciones')
    await page.getByRole('group', { name: 'Vista' }).getByRole('button', { name: /Visibilidad/ }).click()
    await expect(page.getByText('Ocultar no protege: quien tenga el enlace puede abrir la aplicación; la protección real la da cada sistema.')).toBeVisible()
    await expect(sinGuardar(page)).toHaveCount(0)

    // --- Por aplicación: A solo para la dirección de prueba1. ---
    await page.getByLabel('Buscar aplicación').fill(sufijo)
    await page.getByRole('button', { name: new RegExp(nombreA) }).click()
    await expect(page.getByRole('heading', { level: 2, name: new RegExp(nombreA) })).toBeVisible()
    await expect(page.getByText(`Visible para ${deps.length} de ${deps.length} direcciones.`)).toBeVisible()
    await page.getByRole('radio', { name: /Solo estas direcciones/ }).check()
    await page.getByLabel('Buscar dirección').fill(depP1.name)
    await page.getByRole('checkbox', { name: depP1.name, exact: true }).check()
    await expect(page.getByText(`Visible para 1 de ${deps.length} direcciones.`)).toBeVisible()
    await expect(page.getByText('1 aplicación modificada')).toBeVisible()

    // El borrador se puede clasificar, pero lo dice.
    await page.getByRole('button', { name: new RegExp(nombreBorrador) }).click()
    await expect(page.getByText('Borrador: no se muestra a nadie aunque se clasifique.').first()).toBeVisible()
    await page.getByRole('radio', { name: /Solo estas direcciones/ }).check()
    await page.getByLabel('Buscar dirección').fill(otro.name)
    await page.getByRole('checkbox', { name: otro.name, exact: true }).check()
    await expect(page.getByText('2 aplicaciones modificadas')).toBeVisible()

    // Copiar de otra aplicación: B toma lo de A.
    await page.getByRole('button', { name: new RegExp(nombreB) }).click()
    await page.getByLabel('Copiar de otra aplicación').selectOption({ label: nombreA })
    await page.getByRole('button', { name: 'Copiar', exact: true }).click()
    await expect(page.getByText(`Visible para 1 de ${deps.length} direcciones.`)).toBeVisible()
    await expect(page.getByText('3 aplicaciones modificadas')).toBeVisible()

    // Descartar deja todo como estaba; se rehace A y se guarda.
    await page.getByRole('button', { name: 'Descartar' }).click()
    await expect(sinGuardar(page)).toHaveCount(0)
    await page.getByRole('button', { name: new RegExp(nombreA) }).click()
    await page.getByRole('radio', { name: /Solo estas direcciones/ }).check()
    await page.getByLabel('Buscar dirección').fill(depP1.name)
    await page.getByRole('checkbox', { name: depP1.name, exact: true }).check()
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(sinGuardar(page)).toHaveCount(0)
    expect(await deptosDe(api, a.id)).toEqual([depP1.id])
    expect(await deptosDe(api, b.id)).toEqual([])

    // prueba1 (de esa dirección) la ve.
    const otra = await browser.newPage()
    await entrar(otra, 'prueba1')
    expect(await catalogoTiene(otra, nombreA)).toBe(true)

    // --- Por dirección: A también para «otro»; B (abierta a todas) se limita quitándosela a «otro». ---
    await page.goto('/gestion/aplicaciones?vista=visibilidad')
    await page.getByRole('group', { name: 'Cómo clasificar' }).getByRole('button', { name: 'Por dirección' }).click()
    await page.getByLabel('Buscar aplicación').fill(sufijo)
    await page.getByLabel('Dirección', { exact: true }).selectOption({ label: otro.name })
    const fila = (n: string) => page.getByRole('listitem').filter({ hasText: n })
    await fila(nombreA).getByRole('checkbox').check()
    await fila(nombreB).getByRole('checkbox').uncheck()
    await expect(fila(nombreB)).toContainText('Cambio pendiente: antes la veían todas las direcciones.')
    await expect(page.getByText('2 aplicaciones modificadas')).toBeVisible()
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(sinGuardar(page)).toHaveCount(0)
    expect((await deptosDe(api, a.id)).sort()).toEqual([depP1.id, otro.id].sort())
    const deB = await deptosDe(api, b.id)
    expect(deB).toHaveLength(deps.length - 1)
    expect(deB).not.toContain(otro.id)

    // Quitarle B también a la dirección de prueba1: prueba1 deja de verla.
    await page.getByLabel('Dirección', { exact: true }).selectOption({ label: depP1.name })
    await fila(nombreB).getByRole('checkbox').uncheck()
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(sinGuardar(page)).toHaveCount(0)
    expect(await deptosDe(api, b.id)).toHaveLength(deps.length - 2)
    await otra.context().clearCookies()
    await entrar(otra, 'prueba1')
    expect(await catalogoTiene(otra, nombreB)).toBe(false)
    expect(await catalogoTiene(otra, nombreA)).toBe(true)
    await otra.close()

    // El resumen es de solo lectura y lista las aplicaciones.
    await page.goto('/gestion/aplicaciones?vista=visibilidad')
    await page.getByRole('button', { name: 'Resumen' }).click()
    await expect(page.getByRole('row', { name: new RegExp(nombreA) })).toContainText('2 de ' + deps.length)
  } finally {
    for (const id of [a.id, b.id, borrador.id]) await api.delete('/api/applications/' + id)
  }
  expect(errores().filter((e) => !/429|Failed to load resource/.test(e))).toEqual([])
})

test('Visibilidad no se desborda en teléfono (sin desplazamiento horizontal de la página)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await entrar(page, 'admin')
  for (const modo of ['Por aplicación', 'Por dirección', 'Resumen']) {
    await page.goto('/gestion/aplicaciones?vista=visibilidad')
    await page.getByRole('group', { name: 'Cómo clasificar' }).getByRole('button', { name: modo }).click()
    await expect(page.locator('.vis').getByText('Ocultar no protege')).toBeVisible()
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(ancho, modo).toBeLessThanOrEqual(0)
    await page.mouse.move(0, 0)
    await page.waitForTimeout(400)
    // Contraste y accesibilidad (WCAG 2.1 AA), también con la clasificación abierta.
    if (modo === 'Por aplicación') await page.getByRole('radio', { name: /Solo estas direcciones/ }).check()
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(violations.map((v) => v.id + ': ' + v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')), modo).toEqual([])
  }
})
