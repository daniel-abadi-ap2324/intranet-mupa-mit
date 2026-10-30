/**
 * Toma las capturas de «Demonstrated functionality» del README contra una intranet ya levantada
 * en edición completa con las cuentas ficticias (docker compose up --build, o la API y la web en local).
 *
 *   node docs/screenshots/tomar-capturas.mjs                         # contra http://localhost:8080
 *   BASE=http://localhost:5173 node docs/screenshots/tomar-capturas.mjs
 *
 * Usa el Playwright de mupa-intranet-app (npm install ahí y, si hace falta, npx playwright install chromium).
 * Antes de capturar crea por la API, con las cuentas ficticias, solo datos de ejemplo: un formulario que
 * recibe solicitudes, tres solicitudes (Recibida, En revisión y Resuelta) y tres noticias marcadas «Ejemplo».
 * Conviene correrlo sobre una base recién creada: cada corrida agrega datos nuevos.
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(path.join(aqui, '../../mupa-intranet-app/package.json'))
const { chromium, request } = require('@playwright/test')

const BASE = (process.env.BASE ?? 'http://localhost:8080').replace(/\/$/, '')
const ANCHO = 1440
const ALTO = 900
const cuenta = (u) => u + '@ejemplo.test'

async function api(usuario) {
  const r = await request.newContext({ baseURL: BASE })
  const login = await r.post('/api/auth/login', { data: { username: cuenta(usuario), password: 'password' } })
  if (!login.ok()) throw new Error(`No se pudo entrar como ${usuario}: ${login.status()}`)
  return r
}

async function json(respuesta) {
  if (!respuesta.ok()) throw new Error(`${respuesta.url()} respondió ${respuesta.status()}: ${await respuesta.text()}`)
  return respuesta.json()
}

const hoy = (dias = 0) => new Date(Date.now() - dias * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'America/Panama' })

// ---------- Datos de ejemplo ----------
const gestor = await api('gestor')
const persona = await api('prueba1')
const comunicacion = await api('comunicacion')

const form = await json(
  await gestor.post('/api/forms', {
    data: {
      title: 'Préstamo de proyector (ejemplo)',
      area: 'Tecnología',
      destination: 'Mesa de Servicios',
      accepting: true,
      sections: [
        { title: 'Quién solicita', fields: [{ k: 'nombre', l: 'Nombre completo', t: 'text', r: true, auto: 'nombreCompleto' }] },
        {
          title: 'Qué necesitas',
          fields: [
            { k: 'fecha', l: 'Cuándo lo necesitas', t: 'text', r: true },
            { k: 'detalle', l: 'Para qué lo necesitas', t: 'textarea', r: true },
          ],
        },
      ],
    },
  }),
)

async function solicitar(detalle) {
  return json(await persona.post('/api/requests', { data: { form: form.slug, respuestas: { v: { s0_nombre: 'Lucía Herrera', s1_fecha: hoy(-3), s1_detalle: detalle }, c: {}, i: {} } } }))
}
const [, enRevision, resuelta] = [await solicitar('Presentación del equipo en la sala 2.'), await solicitar('Capacitación interna del jueves.'), await solicitar('Reunión de coordinación.')]
await json(await gestor.patch(`/api/requests/${enRevision.id}`, { data: { status: 'en_revision' } }))
await json(await gestor.post(`/api/requests/${resuelta.id}/messages`, { data: { body: 'Listo: el proyector queda reservado. Pásalo a buscar a la Mesa de Servicios.' } }))
await json(await gestor.patch(`/api/requests/${resuelta.id}`, { data: { status: 'resuelta' } }))

const NOTICIAS = [
  ['Ejemplo: así se publica una noticia desde Gestión', 'Comunicación escribe el título, el resumen y la fecha, y la noticia aparece en el Inicio y en Noticias.'],
  ['Ejemplo: las noticias también llegan solas del sitio web', 'Con la sincronización encendida, la intranet trae las noticias publicadas en el sitio de la Alcaldía.'],
  ['Ejemplo: una noticia puede ocultarse sin borrarla', 'Desde Gestión, Comunicación puede ocultar una noticia y volver a mostrarla después.'],
]
for (const [i, [title, summary]] of NOTICIAS.entries()) await json(await comunicacion.post('/api/news', { data: { title, summary, type: 'noticia', date: hoy(i), status: 'publicado' } }))

// ---------- Capturas ----------
const navegador = await chromium.launch(process.env.PW_CANAL ? { channel: process.env.PW_CANAL } : {})

async function sesion(usuario) {
  // El recorrido de bienvenida se marca como visto para que no tape la pantalla.
  const ctx = await navegador.newContext({ viewport: { width: ANCHO, height: ALTO }, locale: 'es-PA', deviceScaleFactor: 1, storageState: { cookies: [], origins: [{ origin: BASE, localStorage: [{ name: 'mupa_recorrido', value: '"capturas"' }] }] } })
  const page = await ctx.newPage()
  const r = await page.request.post(BASE + '/api/auth/login', { data: { username: cuenta(usuario), password: 'password' } })
  if (!r.ok()) throw new Error(`No se pudo entrar como ${usuario}`)
  return page
}

async function captura(page, ruta, archivo, { completa = false, antes } = {}) {
  if (ruta) await page.goto(BASE + ruta, { waitUntil: 'load' })
  await page.waitForTimeout(1500)
  if (antes) await antes(page)
  await page.screenshot({ path: path.join(aqui, archivo), fullPage: completa })
  console.log('✓', archivo)
}

const usuario = await sesion('prueba1')
await captura(usuario, '/', 'inicio-personalizable.png')
await captura(usuario, null, 'inicio-personalizar.png', { antes: (p) => p.getByRole('button', { name: /Personalizar/ }).first().click().then(() => p.waitForTimeout(800)) })
await captura(usuario, '/aplicaciones', 'aplicaciones.png')
await captura(usuario, '/directorio', 'directorio.png')
await captura(usuario, '/documentos', 'documentos.png')
await captura(usuario, '/noticias', 'noticias.png')
await captura(usuario, '/mis-solicitudes', 'mis-solicitudes.png')

const pGestor = await sesion('gestor')
await captura(pGestor, `/gestion/formularios/${form.id}`, 'constructor-formularios.png')
await captura(pGestor, '/gestion', 'centro-gestion-gestor.png')
await captura(await sesion('admin'), '/gestion', 'centro-gestion-admin.png')
await captura(await sesion('comunicacion'), '/gestion', 'centro-gestion-comunicacion.png')

// Aviso en vivo: el gestor tiene abierta la intranet y la persona manda una solicitud nueva.
const conectado = pGestor.waitForResponse((r) => r.url().endsWith('/api/notifications/stream') && r.status() === 200)
await pGestor.goto(BASE + '/', { waitUntil: 'load' })
await conectado
await pGestor.waitForTimeout(1000)
const nueva = await solicitar('Charla con proveedores el viernes.')
await pGestor.locator('.home-toast.is-on').waitFor({ timeout: 15_000 })
await captura(pGestor, null, 'aviso-en-vivo.png')
console.log('Folio del aviso:', nueva.folio ?? nueva.id)

// Asistente: esta copia no trae modelo de lenguaje, así que la respuesta es de ejemplo (con datos que ya publica la intranet).
const pAsistente = await sesion('prueba1')
await pAsistente.route('**/api/assistant/status', (r) => r.fulfill({ json: { available: true } }))
await pAsistente.route('**/api/assistant/ask', (r) =>
  r.fulfill({
    json: {
      answer: 'El soporte técnico lo da la Mesa de Servicios de Tecnología. Puedes llamar a la extensión 1400 o escribir a mesadeayuda@pty.gob.pa. En su página también están las solicitudes en línea (código de llamadas y red WIFI) y el video para restablecer tu usuario de máquina.',
      applications: [],
      pages: [{ path: '/mesa-servicios', title: 'Mesa de Servicios' }],
      items: [],
    },
  }),
)
await pAsistente.goto(BASE + '/asistente', { waitUntil: 'load' })
await pAsistente.locator('textarea').fill('¿Dónde pido soporte técnico?')
await pAsistente.getByRole('button', { name: 'Preguntar' }).click()
await pAsistente.getByText('restablecer tu usuario de máquina').last().waitFor({ timeout: 30_000 })
await captura(pAsistente, null, 'asistente.png')

await navegador.close()
