/**
 * Centro de Gestión (/gestion): las cifras de todas las áreas y la bandeja para
 * responder sin cambiar de página. Por ahora todos los gestores ven y atienden
 * todo (también Comunicación). El formulario de prueba queda oculto al final.
 */
import { expect, test } from '@playwright/test'

import { CUENTAS, entrar, paneles, vigilarErrores } from './ayuda'

const FORM = (titulo: string) => ({
  title: titulo,
  area: 'Recursos Humanos',
  destination: 'Equipo de pruebas',
  accepting: true,
  sections: [
    { title: 'Quién solicita', fields: [{ k: 'nombre', l: 'Nombre completo', t: 'text', r: true, auto: 'nombreCompleto' }] },
    { title: 'Qué necesitas', fields: [{ k: 'detalle', l: 'Detalle', t: 'textarea', r: true }] },
  ],
})

test('Comunicación ve todas las áreas y responde una solicitud de RRHH desde la bandeja', async ({ page, baseURL, playwright }) => {
  const errores = vigilarErrores(page)
  const titulo = 'Centro e2e ' + Date.now()
  const gestorApi = await playwright.request.newContext({ baseURL })
  const personaApi = await playwright.request.newContext({ baseURL })
  expect((await gestorApi.post('/api/auth/login', { data: { username: CUENTAS.gestor, password: 'password' } })).ok()).toBeTruthy()
  expect((await personaApi.post('/api/auth/login', { data: { username: CUENTAS.prueba1, password: 'password' } })).ok()).toBeTruthy()
  const form = await (await gestorApi.post('/api/forms', { data: FORM(titulo) })).json()
  try {
    const r = await personaApi.post('/api/requests', { data: { form: form.slug, respuestas: { v: { s0_nombre: 'Prueba Uno', s1_detalle: 'Una constancia.' }, c: {}, i: {} } } })
    expect(r.status()).toBe(201)
    const { id, folio } = await r.json()

    await entrar(page, 'comunicacion')
    await page.locator('#sidebar').getByRole('link', { name: 'Centro de Gestión' }).click()
    await expect(page).toHaveURL(/\/gestion$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Panel de gestión' })).toBeVisible()
    const areas = paneles(page)
    for (const t of ['Resumen', 'Solicitudes', 'Recursos Humanos', 'Comunicación', 'Administración']) await expect(areas.getByRole('link', { name: t, exact: true })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Cifras principales' })).toContainText('Nuevas')
    await expect(page.getByRole('region', { name: 'Solicitudes por formulario' })).toContainText(titulo)

    // RRHH: solo las de Recursos Humanos. Se abre desde la lista y se responde con una respuesta rápida.
    await areas.getByRole('link', { name: 'Recursos Humanos', exact: true }).click()
    await expect(page).toHaveURL(/area=rrhh/)
    const item = page.locator('#cg-sol-' + id)
    await expect(item).toContainText(folio)
    await item.click()
    const detalle = page.getByRole('region', { name: 'Solicitud abierta' })
    await expect(detalle.getByText('Una constancia.')).toBeVisible()
    await detalle.getByRole('group', { name: 'Respuestas rápidas' }).getByRole('button', { name: 'Lista' }).click()
    await expect(detalle.getByLabel(/^Responder a/)).toHaveValue(/ya está atendida/)
    await detalle.getByRole('button', { name: 'Enviar y marcar resuelta' }).click()
    await expect(page.locator('.home-toast.is-on')).toContainText('Respuesta enviada y solicitud resuelta')
    await expect(detalle.locator('.sol-cabecera .tagline')).toHaveText('Resuelta')

    // La persona la ve resuelta y con la respuesta.
    const suya = await (await personaApi.get('/api/requests/' + id)).json()
    expect(suya.status).toBe('resuelta')
    expect(suya.events.some((e: { type: string; body: string | null }) => e.type === 'mensaje' && /ya está atendida/.test(e.body ?? ''))).toBe(true)
    expect(errores()).toEqual([])
  } finally {
    await gestorApi.patch('/api/forms/' + form.id, { data: { accepting: false, published: false } })
    await Promise.all([gestorApi.dispose(), personaApi.dispose()])
  }
})

test('desde el Resumen, una cifra lleva a la bandeja filtrada; con j/k se recorre', async ({ page }) => {
  await entrar(page, 'admin')
  await page.goto('/gestion')
  await page.getByRole('region', { name: 'Cifras principales' }).getByRole('button', { name: /Resueltas/ }).click()
  await expect(page).toHaveURL(/area=solicitudes/)
  await expect(page).toHaveURL(/estado=resuelta/)
  await expect(page.getByRole('group', { name: 'Qué solicitudes mostrar' }).getByRole('button', { name: 'Resuelta' })).toHaveAttribute('aria-pressed', 'true')
  // En pantalla ancha se abre la primera; "j" pasa a la siguiente si hay.
  const activa = page.locator('.cg-sol.is-activa')
  await expect(activa).toHaveCount(1)
  const primera = await activa.getAttribute('id')
  if ((await page.locator('.cg-sol').count()) > 1) {
    await page.locator('body').press('j')
    await expect(activa).not.toHaveAttribute('id', primera!)
  }
})

test('la gestión es una página aparte con todas las secciones en su barra azul; cada pantalla marca la suya', async ({ page }) => {
  const errores = vigilarErrores(page)
  await entrar(page, 'admin')
  // En el menú de la intranet, la gestión sigue siendo una sola entrada: el Centro de Gestión.
  await expect(page.locator('#sidebar a[href^="/gestion"]')).toHaveCount(1)
  await page.locator('#sidebar').getByRole('link', { name: 'Centro de Gestión' }).click()

  // Sin el menú ni la barra de la intranet, con «volver» y las secciones de gestión a la izquierda.
  await expect(page.locator('#sidebar')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Volver a la intranet' }).first()).toBeVisible()
  const barra = paneles(page)
  for (const area of ['Resumen', 'Solicitudes', 'Recursos Humanos', 'Comunicación', 'Administración']) await expect(barra.getByRole('link', { name: area, exact: true })).toBeVisible()
  await expect(barra.getByRole('link', { name: 'Resumen', exact: true })).toHaveAttribute('aria-current', 'page')

  // Cada área abre sus pantallas debajo; la pantalla abierta queda marcada.
  await barra.getByRole('link', { name: 'Comunicación', exact: true }).click()
  await expect(page).toHaveURL(/area=comunicacion/)
  await expect(barra.getByRole('link', { name: 'Usuarios', exact: true })).toHaveCount(0)
  await barra.getByRole('link', { name: 'Anuncios', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Anuncios del Inicio' })).toBeVisible()
  await expect(barra.getByRole('link', { name: 'Anuncios', exact: true })).toHaveAttribute('aria-current', 'page')
  await barra.getByRole('link', { name: 'Boletines', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Boletines' })).toBeVisible()
  await expect(barra.getByRole('link', { name: 'Boletines', exact: true })).toHaveAttribute('aria-current', 'page')
  await barra.getByRole('link', { name: 'Resumen', exact: true }).click()
  await expect(page).toHaveURL(/\/gestion$/)

  // «Volver a la intranet» regresa al sitio, con su menú.
  await page.getByRole('link', { name: 'Volver a la intranet' }).first().click()
  await expect(page.locator('#sidebar')).toBeVisible()
  expect(errores()).toEqual([])
})

test('«Atrasadas» lleva a la bandeja con solo las atrasadas', async ({ page }) => {
  await entrar(page, 'gestor')
  await page.goto('/gestion')
  await page.getByRole('region', { name: 'Cifras principales' }).getByRole('button', { name: /Atrasadas/ }).click()
  await expect(page).toHaveURL(/estado=atrasadas/)
  const chip = page.getByRole('group', { name: 'Qué solicitudes mostrar' }).getByRole('button', { name: 'Atrasadas' })
  await expect(chip).toHaveAttribute('aria-pressed', 'true')
  // La lista coincide con la cifra.
  const n = Number(await page.getByRole('region', { name: 'Cifras de solicitudes' }).getByRole('button', { name: /Atrasadas/ }).locator('.cg-kpi__val').innerText())
  await expect(page.locator('.cg-bandeja__n')).toContainText(n === 1 ? '1 solicitud' : n + ' solicitudes')
})

test('un usuario no entra al Centro de Gestión ni lo ve en el menú', async ({ page }) => {
  await entrar(page, 'prueba1')
  await expect(page.locator('#sidebar').getByRole('link', { name: 'Centro de Gestión' })).toHaveCount(0)
  await page.goto('/gestion')
  await expect(page.getByText('No tienes permiso para usar esta sección.')).toBeVisible()
})
