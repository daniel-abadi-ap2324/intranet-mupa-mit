/**
 * El circuito completo de una solicitud: un formulario que recibe solicitudes,
 * una persona que la envía y la sigue, y el Gestor que cambia el estado y
 * responde. Al final el formulario de prueba queda oculto y sin recibir (no se
 * puede borrar porque ya tiene solicitudes).
 */
import { expect, test, type APIRequestContext } from '@playwright/test'

import { CUENTAS, entrar, vigilarErrores, panelGestion } from './ayuda'

const FORM = (titulo: string) => ({
  title: titulo,
  area: 'Pruebas de punta a punta',
  destination: 'Equipo de pruebas',
  accepting: true,
  sections: [
    { title: 'Quién solicita', fields: [{ k: 'nombre', l: 'Nombre completo', t: 'text', r: true, auto: 'nombreCompleto' }] },
    { title: 'Qué necesitas', fields: [{ k: 'detalle', l: 'Detalle', t: 'textarea', r: true }] },
  ],
})

async function comoGestor(baseURL: string, playwright: { request: { newContext: (o: { baseURL: string }) => Promise<APIRequestContext> } }) {
  const ctx = await playwright.request.newContext({ baseURL })
  expect((await ctx.post('/api/auth/login', { data: { username: CUENTAS.gestor, password: 'password' } })).ok()).toBeTruthy()
  return ctx
}

test('una persona envía una solicitud, el Gestor la atiende y la persona ve la respuesta', async ({ page, browser, baseURL, playwright }) => {
  const errores = vigilarErrores(page)
  const titulo = 'Solicitud e2e ' + Date.now()
  const gestorApi = await comoGestor(baseURL!, playwright)
  const form = await (await gestorApi.post('/api/forms', { data: FORM(titulo) })).json()
  try {
    // La persona envía la solicitud.
    await entrar(page, 'prueba1')
    await page.goto('/formularios/' + form.slug)
    await expect(page.getByLabel(/Nombre completo/)).toHaveValue(/.+/)
    await page.getByRole('button', { name: 'Enviar solicitud' }).first().click()
    await expect(page.getByRole('alert')).toContainText('Completa «Detalle».')
    await page.getByLabel(/^Detalle/).fill('Necesito un teclado nuevo.')
    await page.getByRole('button', { name: 'Enviar solicitud' }).first().click()
    const titular = page.getByRole('heading', { name: /Solicitud enviada · SOL-\d{4}-\d{6}/ })
    await expect(titular).toBeVisible()
    const folio = (await titular.innerText()).match(/SOL-\d{4}-\d{6}/)![0]
    await page.getByRole('link', { name: 'Ver en Mis solicitudes' }).click()
    await expect(page.getByText('Necesito un teclado nuevo.')).toBeVisible()
    await expect(page.locator('.sol-cabecera')).toContainText('Recibida')

    // El Gestor la encuentra, cambia el estado y responde.
    const gestor = await browser.newPage()
    await entrar(gestor, 'gestor')
    await expect((await panelGestion(gestor)).getByRole('link', { name: /Solicitudes/ })).toContainText('nueva')
    await gestor.goto('/gestion/solicitudes')
    await gestor.getByLabel('Buscar solicitud').fill(folio)
    await gestor.getByRole('link', { name: 'Abrir ' + folio }).click()
    await expect(gestor.getByText('Necesito un teclado nuevo.')).toBeVisible()
    await gestor.getByLabel('Estado').selectOption({ label: 'En revisión' })
    await expect(gestor.locator('.home-toast.is-on')).toContainText('Estado cambiado')
    await gestor.getByRole('button', { name: 'Enviar respuesta' }).click()
    await expect(gestor.getByText('Escribe la respuesta.')).toBeVisible()
    await gestor.getByLabel(/^Responder a/).fill('Tu teclado llega el lunes.')
    await gestor.getByRole('button', { name: 'Enviar respuesta' }).click()
    await expect(gestor.locator('.sol-evento--mensaje')).toContainText('Tu teclado llega el lunes.')
    await gestor.close()

    // La persona ve la novedad en la campana y la abre.
    await page.goto('/')
    const campana = page.getByRole('button', { name: /Notificaciones: \d+ solicitud/ })
    await expect(campana).toBeVisible()
    await campana.click()
    await page.locator('#notifs').getByRole('link', { name: new RegExp('Nueva respuesta · ' + folio) }).click()
    await expect(page.locator('.sol-evento--mensaje')).toContainText('Tu teclado llega el lunes.')
    await expect(page.locator('.sol-cabecera')).toContainText('En revisión')
    await expect(page.getByRole('button', { name: 'Notificaciones', exact: true })).toBeVisible()
    expect(errores()).toEqual([])
  } finally {
    await gestorApi.patch('/api/forms/' + form.id, { data: { accepting: false, published: false } })
    await gestorApi.dispose()
  }
})

test('sin sesión no se envía una solicitud real; los formularios de prueba siguen simulando', async ({ page, baseURL, playwright }) => {
  const titulo = 'Solicitud e2e anónima ' + Date.now()
  const gestorApi = await comoGestor(baseURL!, playwright)
  const form = await (await gestorApi.post('/api/forms', { data: FORM(titulo) })).json()
  try {
    await page.goto('/formularios/' + form.slug)
    await expect(page.getByText('Para enviar esta solicitud tienes que')).toBeVisible()
    await page.getByLabel(/Nombre completo/).fill('Sin sesión')
    await page.getByLabel(/^Detalle/).fill('Algo')
    await page.getByRole('button', { name: 'Enviar solicitud' }).first().click()
    await expect(page.getByRole('alert').filter({ hasText: 'Inicia sesión para enviar la solicitud.' })).toBeVisible()
  } finally {
    await gestorApi.delete('/api/forms/' + form.id)
    await gestorApi.dispose()
  }
  // Un formulario que no recibe solicitudes sigue con el envío de prueba.
  await page.goto('/formularios/codigo-de-impresion')
  await expect(page.getByRole('button', { name: 'Revisar y enviar' }).first()).toBeVisible()
})

test('un usuario no entra a la bandeja del Gestor', async ({ page }) => {
  await entrar(page, 'prueba1')
  await page.goto('/gestion/solicitudes')
  await expect(page.getByText('No tienes permiso para usar esta sección.')).toBeVisible()
  // La gestión es una página aparte: quien no tiene permiso puede volver a la intranet desde ahí.
  await expect(page.getByRole('link', { name: 'Volver a la intranet' }).first()).toBeVisible()
})

test('al llegar una solicitud, admin y Gestor la ven en vivo; un usuario no escucha nada', async ({ browser, baseURL, playwright }) => {
  const titulo = 'Solicitud en vivo e2e ' + Date.now()
  const gestorApi = await comoGestor(baseURL!, playwright)
  const form = await (await gestorApi.post('/api/forms', { data: FORM(titulo) })).json()
  const personaApi = await playwright.request.newContext({ baseURL })
  const [gestor, admin, persona] = await Promise.all([browser.newPage(), browser.newPage(), browser.newPage()])
  const errores = [gestor, admin, persona].map(vigilarErrores)
  const conectado = (p: typeof gestor) => p.waitForResponse((r) => r.url().endsWith('/api/notifications/stream') && r.status() === 200)
  try {
    // Gestor en la bandeja, admin en su Inicio, la persona en el suyo.
    const gestorConectado = conectado(gestor)
    await entrar(gestor, 'gestor')
    await gestor.goto('/gestion/solicitudes')
    await gestorConectado
    const adminConectado = conectado(admin)
    await entrar(admin, 'admin')
    await adminConectado
    const panel = (await panelGestion(admin)).getByRole('link', { name: /Solicitudes/ })
    const nuevasAntes = Number((await panel.innerText()).match(/(\d+) nueva/)?.[1] ?? 0)
    const pedidosPersona: string[] = []
    persona.on('request', (r) => pedidosPersona.push(r.url()))
    await entrar(persona, 'prueba1')

    // La persona envía la solicitud (por la API: la pantalla ya se prueba arriba).
    expect((await personaApi.post('/api/auth/login', { data: { username: CUENTAS.prueba1, password: 'password' } })).ok()).toBeTruthy()
    const r = await personaApi.post('/api/requests', { data: { form: form.slug, respuestas: { v: { s0_nombre: 'Prueba Uno', s1_detalle: 'Un monitor.' }, c: {}, i: {} } } })
    expect(r.status()).toBe(201)
    const { id, folio } = await r.json()

    // Sin recargar: aviso al Gestor, y su bandeja ya la muestra.
    const aviso = gestor.locator('.home-toast.is-on')
    await expect(aviso).toContainText(`Nueva solicitud · ${folio} · ${titulo}`)
    await expect(gestor.getByRole('link', { name: 'Abrir ' + folio })).toBeVisible()
    // «Ver» la abre en la bandeja del Centro de Gestión.
    await aviso.getByRole('button', { name: 'Ver' }).click()
    await expect(gestor).toHaveURL(new RegExp('/gestion\\?area=solicitudes&id=' + id + '$'))
    await expect(gestor.getByText('Un monitor.')).toBeVisible()

    // Al admin también, y "Tu panel de gestión" suma la nueva.
    await expect(admin.locator('.home-toast.is-on')).toContainText(folio)
    await expect(panel).toContainText(`${nuevasAntes + 1} nueva`)

    // La persona (funcionario) no abre el stream ni ve avisos.
    await persona.waitForTimeout(500)
    expect(pedidosPersona.filter((u) => u.includes('/api/notifications/'))).toEqual([])
    await expect(persona.locator('.home-toast.is-on')).toHaveCount(0)
    for (const e of errores) expect(e()).toEqual([])
  } finally {
    await Promise.all([gestor.close(), admin.close(), persona.close()])
    await gestorApi.patch('/api/forms/' + form.id, { data: { accepting: false, published: false } })
    await Promise.all([gestorApi.dispose(), personaApi.dispose()])
  }
})

test('la campana del Gestor lista las solicitudes por atender, suena al llegar una y la saca al atenderla', async ({ browser, baseURL, playwright }) => {
  const titulo = 'Solicitud campana e2e ' + Date.now()
  const gestorApi = await comoGestor(baseURL!, playwright)
  const form = await (await gestorApi.post('/api/forms', { data: FORM(titulo) })).json()
  const personaApi = await playwright.request.newContext({ baseURL })
  const gestor = await browser.newPage()
  const errores = vigilarErrores(gestor)
  const sonidos: string[] = []
  gestor.on('request', (r) => r.url().endsWith('/sonidos/notificacion.wav') && sonidos.push(r.url()))
  try {
    const conectado = gestor.waitForResponse((r) => r.url().endsWith('/api/notifications/stream') && r.status() === 200)
    await entrar(gestor, 'gestor')
    await conectado
    // El navegador solo deja sonar después de que la persona tocó la página.
    await gestor.locator('body').click({ position: { x: 5, y: 5 } })
    const numero = gestor.locator('.app-notifbtn__n')
    const antes = Number((await numero.count()) ? await numero.innerText() : 0)

    expect((await personaApi.post('/api/auth/login', { data: { username: CUENTAS.prueba1, password: 'password' } })).ok()).toBeTruthy()
    const r = await personaApi.post('/api/requests', { data: { form: form.slug, respuestas: { v: { s0_nombre: 'Prueba Uno', s1_detalle: 'Una silla.' }, c: {}, i: {} } } })
    const { id, folio } = await r.json()

    // Sin recargar: suena, el número sube y la campana la lista con enlace a la solicitud.
    await expect(numero).toHaveText(String(antes + 1))
    await expect.poll(() => sonidos.length).toBeGreaterThan(0)
    await gestor.getByRole('button', { name: /^Notificaciones/ }).click()
    const enlace = gestor.locator('#notifs').getByRole('link', { name: new RegExp(`Nueva solicitud · ${folio}`) })
    await expect(enlace).toContainText(titulo)
    await enlace.click()
    await expect(gestor).toHaveURL(new RegExp('/gestion\\?area=solicitudes&id=' + id + '$'))

    // Al atenderla (cambiar el estado) deja de estar por atender.
    await gestor.getByLabel('Estado').selectOption({ label: 'En revisión' })
    await expect(gestor.locator('.home-toast.is-on')).toContainText('Estado cambiado')
    // La campana está en la barra de la intranet, no en la página de gestión.
    await gestor.goto('/')
    await gestor.getByRole('button', { name: /^Notificaciones/ }).click()
    await expect(gestor.locator('#notifs').getByRole('link', { name: new RegExp(folio) })).toHaveCount(0)
    expect(errores()).toEqual([])
  } finally {
    await gestor.close()
    await gestorApi.patch('/api/forms/' + form.id, { data: { accepting: false, published: false } })
    await Promise.all([gestorApi.dispose(), personaApi.dispose()])
  }
})
