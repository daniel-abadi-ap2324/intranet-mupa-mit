/**
 * Edición publicación: lo que se publica funciona y no hay nada apagado ni roto. Todo lo que se
 * construye se publica (decisión de Daniel, 1-oct-2026): ya no se prohíben los textos «Pendiente»,
 * «Ejemplo» ni los enlaces a la intranet vieja. Web y API en esa edición
 * (playwright.publicacion.config.ts), con las cuentas ficticias del backend de pruebas.
 */
import { expect, test, type Page } from '@playwright/test'

import { entrar, vigilarErrores } from '../e2e/ayuda'

// Copia de la VM (rama vm/publicacion): también están apagados los formularios internos, su constructor, la bandeja de
// gestión, el detalle de una solicitud interna y los avisos en vivo. «Mis solicitudes» (citas, códigos y tickets) sigue.
const APAGADAS = /^\/(videos|formularios|mis-solicitudes\/[^/]+|gestion\/(anuncios|videos|inicio|formularios|solicitudes))(\/|$)/
const API_APAGADA = /\/api\/(announcements|videos|forms|requests|notifications)(\/|\?|$)/

/** Vigila la red: ninguna petición a la API de lo apagado. */
function vigilarRed(page: Page) {
  const malas: string[] = []
  page.on('request', (r) => {
    const u = r.url()
    if (API_APAGADA.test(new URL(u).pathname)) malas.push(u)
  })
  return () => malas
}

/** Revisa la página abierta: que se vea y que no enlace a lo apagado. */
async function revisar(page: Page, ruta: string) {
  await expect(page.locator('#contenido h1').first(), ruta).toBeVisible()
  // Daniel (21-oct-2026): en esta edición no se ve ningún «Próximamente» ni «Pendiente de…».
  await expect(page.locator('#contenido'), ruta).not.toContainText(/Pr[oó]ximamente|Pendiente de|A definir/i)
  const enlaces = await page.locator('a[href]').evaluateAll((as) => as.map((a) => a.getAttribute('href') || ''))
  for (const h of enlaces) {
    if (h.startsWith('/')) expect(APAGADAS.test(h.split(/[?#]/)[0]), `${ruta}: enlace a algo apagado ${h}`).toBe(false)
  }
}

test('las páginas apagadas no existen (404) y la API no tiene sus rutas', async ({ page, request }) => {
  for (const ruta of ['/recursos-humanos', '/recursos-humanos?seccion=comprobantes', '/videos', '/gestion/anuncios', '/gestion/inicio', '/formularios', '/formularios/codigo-de-impresion', '/gestion/formularios', '/gestion/solicitudes', '/mis-solicitudes/1']) {
    await page.goto(ruta)
    await expect(page.getByRole('heading', { level: 1, name: 'Página no encontrada' }), ruta).toBeVisible()
  }
  for (const ruta of ['/api/announcements', '/api/videos', '/api/forms', '/api/requests/mine', '/api/notifications']) expect((await request.get(ruta)).status(), ruta).toBe(404)
  // Las noticias van en las dos ediciones (llegan solas de mupa.gob.pa).
  expect((await request.get('/api/news')).status()).toBe(200)
  await page.goto('/noticias')
  await expect(page.getByRole('heading', { level: 1, name: 'Página no encontrada' })).toHaveCount(0)
  // «Mis solicitudes» (citas de la Clínica, códigos de llamada y tickets de GLPI) sí existe.
  await page.goto('/mis-solicitudes')
  await expect(page.getByRole('heading', { level: 1, name: 'Página no encontrada' })).toHaveCount(0)
})

test('sin sesión: todas las páginas del menú funcionan, sin nada apagado', async ({ page }) => {
  const errores = vigilarErrores(page)
  const red = vigilarRed(page)
  await page.goto('/')
  await expect(page.locator('#sidebar a[href^="/"]').first()).toBeVisible()
  const rutas = await page
    .locator('#sidebar a[href^="/"]')
    .evaluateAll((as) => [...new Set(as.map((a) => (a.getAttribute('href') || '').split('#')[0]).filter((h) => !/\.(pdf|jpg|png|mp4)$/i.test(h) && h !== '/entrar' && h !== '/registro'))])
  expect(rutas).toEqual(expect.arrayContaining(['/', '/aplicaciones', '/directorio', '/documentos', '/clinica', '/configuracion']))
  // Recursos Humanos se quitó de esta edición (29-oct-2026) hasta revisar RRHH Express.
  expect(rutas).not.toContain('/recursos-humanos')
  for (const ruta of rutas) {
    await page.goto(ruta)
    await revisar(page, ruta)
  }
  expect(red()).toEqual([])
  expect(errores()).toEqual([])
})

test('Inicio: con noticias, sin cifras ni campañas, enlaces que abren y búsqueda sin lo apagado', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#homeGrid > .home-w').first()).toBeVisible()
  expect(await page.locator('#homeGrid > .home-w').evaluateAll((ws) => ws.map((w) => (w as HTMLElement).dataset.uid))).toEqual([
    'buscador', 'accesos', 'directorio', 'mesa', 'solicitudes', 'noticias', 'boletines', 'clinica', 'frecuentes', 'enlaces', 'marca',
  ])
  await expect(page.locator('.kpi-row, .home-campaigns')).toHaveCount(0)
  const chips = page.locator('.inst-chip')
  await expect(chips).toHaveCount(8)
  for (const h of await chips.evaluateAll((as) => as.map((a) => a.getAttribute('href')))) expect(h).toMatch(/^https:\/\//)

  // Las búsquedas más comunes encuentran algo.
  for (const chip of ['Carta de trabajo', 'Agendar cita', 'Correo institucional', 'Directorio', 'Boletines']) {
    await page.getByLabel('¿Qué necesitas hoy?').fill(chip)
    await expect(page.locator('.home-res__grupo').first(), chip).toBeVisible()
  }
})

test('Mesa de Servicios: los videos instructivos se abren desde el sitio nuevo', async ({ page, request }) => {
  await page.goto('/mesa-servicios#videos')
  const partes = page.locator('#videos .msv-parte')
  await expect(partes).toHaveCount(3)
  for (let i = 0; i < 3; i++) {
    await partes.nth(i).click()
    const h = (await page.locator('#videos .msv-video__panel').getAttribute('href'))!
    expect(h).toBe(`/sitio/2024/08/parte${i + 1}.mp4`)
    const r = await request.head(h)
    expect(r.status(), h).toBe(200)
  }
})

test('Directorio: el directorio fijo, con búsqueda', async ({ page }) => {
  await page.goto('/directorio')
  await expect(page.locator('.count-note')).toHaveText(/^Mostrando 40 de [0-9]+ extensiones$/)
  const total = Number((await page.locator('.count-note').innerText()).split(' ')[3])
  // En esta copia el directorio es ficticio: unas 220 extensiones.
  expect(total).toBeGreaterThan(200)
  await page.getByLabel('Buscar en el directorio').fill('1400')
  await expect(page.locator('.ds-table tbody tr').first()).toContainText('1400')
})

test('catálogo: todo lo publicado está confirmado y lleva a algún lado', async ({ page }) => {
  await page.goto('/aplicaciones')
  await expect(page.locator('.app-tile, .sys-card').first()).toBeVisible()
  await expect(page.getByText('Por confirmar')).toHaveCount(0)
})

test('administración: usuarios, departamentos y catálogo funcionan; lo apagado de gestión no aparece', async ({ page }) => {
  const errores = vigilarErrores(page)
  const red = vigilarRed(page)
  await entrar(page, 'admin')
  // En el menú de la intranet la gestión es solo el Centro; las pantallas están en la barra azul de la página de gestión.
  expect(await page.locator('#sidebar a[href^="/gestion"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')))).toEqual(['/gestion'])
  await page.goto('/gestion')
  await expect(page.locator('.gx-nav')).toBeVisible()
  // Todas las áreas abiertas, para listar sus pantallas.
  const plegados = page.locator('.gx-nav').getByRole('button', { name: /^Mostrar / })
  while (await plegados.count()) await plegados.first().click()
  const gestion = await page.locator('.gx-nav a[href^="/gestion/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')))
  expect(gestion.sort()).toEqual(['/gestion/aplicaciones', '/gestion/boletines', '/gestion/departamentos', '/gestion/noticias', '/gestion/usuarios'])
  for (const ruta of gestion as string[]) {
    await page.goto(ruta)
    // En el catálogo, administración ve los borradores (algunos por confirmar): es donde se confirman.
    await revisar(page, ruta)
  }
  await page.goto('/gestion/departamentos')
  await expect(page.getByText('Dirección de Tecnología e Innovación')).toBeVisible()
  expect(red()).toEqual([])
  expect(errores()).toEqual([])
})

test('el Centro de Gestión solo muestra lo publicado: boletines y administración (sin solicitudes)', async ({ page }) => {
  const errores = vigilarErrores(page)
  const red = vigilarRed(page)
  await entrar(page, 'admin')
  await page.locator('#sidebar').getByRole('link', { name: 'Centro de Gestión' }).click()
  await expect(page).toHaveURL(/\/gestion$/)
  // La gestión es una página aparte: las áreas son las secciones de su barra azul.
  const areas = page.locator('.gx-nav .gx-fila > a')
  await expect(areas).toHaveText(['Resumen', 'Comunicación', 'Administración'])
  await expect(page.getByRole('region', { name: 'Cifras principales' })).toContainText('Boletines')
  await revisar(page, '/gestion')
  await expect(page.locator('.cg-kpi, .kpi-row').getByText('Atrasadas')).toHaveCount(0)
  for (const t of ['Comunicación', 'Administración']) {
    await page.locator('.gx-nav').getByRole('link', { name: t, exact: true }).click()
    await revisar(page, '/gestion ' + t)
  }
  expect(red()).toEqual([])
  expect(errores()).toEqual([])
})

test('lo que se pedía en la intranet actual: WIFI, código de llamadas, boletines e instructivo de la Clínica', async ({ page, request }) => {
  await page.goto('/')
  await expect(page.locator('#homeGrid > .home-w').first()).toBeVisible()
  const caja = page.getByLabel('¿Qué necesitas hoy?')
  const resultados = page.locator('#inicio-resultados')
  await caja.fill('solicitar internet')
  await expect(resultados.locator('a[href="http://wifi.mupa.gob.pa:9001/solicitud"]').first()).toBeVisible()
  await caja.fill('código de llamadas')
  await expect(resultados.locator('a[href="https://cdr.mupa.gob.pa/pinrequests/create"]').first()).toBeVisible()

  // Boletines: su página y un PDF que abre.
  await page.goto('/boletines')
  await expect(page.getByRole('heading', { level: 1, name: 'Alcaldía al día' })).toBeVisible()
  const pdf = await page.locator('.bol-row a', { hasText: 'Abrir PDF' }).first().getAttribute('href')
  expect((await request.head(pdf!)).status()).toBe(200)

  // El instructivo del sistema de la Clínica, copiado al sitio nuevo.
  await page.goto('/clinica')
  const instructivo = page.locator('#contenido').getByRole('link', { name: /Instructivo del sistema de la Clínica/ }).first()
  await expect(instructivo).toBeVisible()
  expect((await request.head((await instructivo.getAttribute('href'))!)).status()).toBe(200)
})

test('Documentos: sin filas «Próximamente» (Recursos Humanos está quitada de esta edición)', async ({ page, request }) => {
  const errores = vigilarErrores(page)
  const red = vigilarRed(page)
  // RRHH Express en mantenimiento: la API no lo ofrece ni entrega datos.
  expect(await (await request.get('/api/rrhh/conexion')).json()).toMatchObject({ available: false, maintenance: true })
  expect((await request.get('/api/rrhh/comprobantes')).status()).toBe(503)
  await page.goto('/documentos')
  await revisar(page, '/documentos')
  await expect(page.locator('.doc-card', { hasText: 'Equiparación de Oportunidades' })).toHaveCount(0)
  await expect(page.locator('#contenido')).not.toContainText('Próximamente')
  expect(red()).toEqual([])
  expect(errores()).toEqual([])
})

test('Identidad visual: también sale en la edición publicación (sección, guía del logo y tarjeta del Inicio)', async ({ page, request }) => {
  const errores = vigilarErrores(page)
  const red = vigilarRed(page)
  await page.goto('/')
  await expect(page.locator('#identidad-visual').getByRole('heading', { name: 'Identidad visual' })).toBeVisible()
  await page.goto('/comunicacion')
  await expect(page.getByRole('heading', { level: 1, name: 'Identidad visual y comunicación' })).toBeVisible()
  await expect(page.locator('.cm-logo')).toHaveCount(16)
  await expect(page.locator('#paleta .cm-color').first()).toBeVisible()
  await expect(page.locator('#redes a')).toHaveCount(10)
  // Los archivos viajan en la imagen: responden con su tipo.
  for (const [ruta, tipo] of [['/marca/logos/svg/logo-azul-sobre-blanco-horizontal.svg', /svg/], ['/marca/manual/manual-de-marca.pdf', /pdf/], ['/marca/tipografias/Montserrat.zip', /zip/]] as const) {
    const r = await request.head(ruta)
    expect(r.status(), ruta).toBe(200)
    expect(r.headers()['content-type'], ruta).toMatch(tipo)
  }
  await page.goto('/comunicacion/guia-del-logo')
  await expect(page.getByRole('heading', { level: 1, name: 'Guía rápida de uso del logo' })).toBeVisible()
  expect(red()).toEqual([])
  expect(errores()).toEqual([])
})

test('Mesa de Servicios y Mis solicitudes: solo enlaces a sistemas externos y lo que funciona con sistemas reales', async ({ page }) => {
  const errores = vigilarErrores(page)
  const red = vigilarRed(page)
  await page.goto('/mesa-servicios')
  await revisar(page, '/mesa-servicios')
  // Código de llamadas y WIFI abren su propio sistema; los formularios internos ya no están.
  await expect(page.locator('a[href="https://cdr.mupa.gob.pa/pinrequests/create"]').first()).toBeVisible()
  await expect(page.locator('a[href="http://wifi.mupa.gob.pa:9001/solicitud"]').first()).toBeVisible()
  await expect(page.locator('a[href^="/formularios"]')).toHaveCount(0)
  await expect(page.locator('#contenido')).toContainText('ext. 1400')
  await expect(page.locator('#contenido')).not.toContainText('Aprobaciones')

  await entrar(page, 'admin')
  await page.goto('/mis-solicitudes')
  await revisar(page, '/mis-solicitudes')
  await expect(page.getByRole('link', { name: /Nueva solicitud/ })).toHaveCount(0)
  await expect(page.locator('.app-notifbtn')).toHaveCount(0)
  await expect(page.locator('#contenido')).toContainText('citas de la Clínica')
  expect(red()).toEqual([])
  expect(errores()).toEqual([])
})
