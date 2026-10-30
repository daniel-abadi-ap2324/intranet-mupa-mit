/** Páginas de sección migradas del prototipo: cargan sin errores (tampoco de CSP) y funcionan sus filtros. */
import fs from 'node:fs'

import { expect, test } from '@playwright/test'

import { api, vigilarErrores } from './ayuda'

type Persona = { nombre: string; apellido: string; direccion: string; ext: string }
const PERSONAS: Persona[] = JSON.parse(fs.readFileSync(new URL('../../src/data/directorio-personas.json', import.meta.url), 'utf8'))

// Una persona del directorio real cuya extensión no se repite ni aparece dentro de otro dato.
const unica = PERSONAS.find((p) => PERSONAS.filter((q) => JSON.stringify(q).includes(p.ext)).length === 1)!

/** [ruta, título de la pestaña, h1, un elemento clave] */
const PAGINAS: [string, string, string, string][] = [
  ['/documentos', 'Documentos', 'Documentos', '.doc-grid .doc-card'],
  ['/formularios', 'Formularios de solicitud', 'Formularios de solicitud', '.sys-card'],
  ['/manuales', 'Manuales', 'Manuales y documentos', '.doc-list .doc-row'],
  ['/boletines', 'Boletines', 'Alcaldía al día', '.bol-row'],
  ['/videos', 'Videos', 'Videos', '.video-card'],
  ['/recursos-humanos', 'Recursos Humanos', 'Recursos Humanos', '.rh-docs .rh-doc'],
  ['/clinica', 'Clínica Municipal', 'Clínica Municipal', '.cl-per'],
  ['/clinica-recetas', 'Solicitar recetas', 'Requisitos para solicitar recetas médicas', '.prose ol li'],
  ['/clinica-medicamentos', 'Medicamentos', 'Listado de medicamentos', 'details.acc'],
  ['/directorio', 'Directorio', 'Directorio institucional', 'table.ds-table tbody tr'],
  // Sin noticias vigentes en los datos iniciales: la página lo dice.
  ['/noticias', 'Noticias', 'Noticias', 'p.empty'],
  ['/mesa-servicios', 'Mesa de Servicios', 'Mesa de Servicios', '.msv-sol'],
  ['/sap-istmo', 'Soporte ISTMO (MEF)', 'Soporte ISTMO (MEF)', '.doc-list .doc-row'],
]

for (const [ruta, pestana, h1, clave] of PAGINAS) {
  test(`${ruta} carga sin errores`, async ({ page }) => {
    const errores = vigilarErrores(page)
    await page.goto(ruta)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(h1)
    await expect(page).toHaveTitle(pestana + ' — Intranet MUPA')
    await expect(page.locator(clave).first()).toBeVisible()
    await expect(page.locator('main')).not.toContainText('undefined')
    await expect(page.locator('#sidebar [aria-current="page"]')).toHaveCount(1)
    expect(errores()).toEqual([])
  })
}

test('Soporte ISTMO: pasos, video de capacitación, las 2 guías y el contacto del MEF, todo local', async ({ page, request }) => {
  await page.goto('/sap-istmo')
  await expect(page.getByRole('link', { name: /Ir al portal de Mesa de Ayuda del MEF/ })).toHaveAttribute('href', 'https://caudnc.mef.gob.pa')
  await expect(page.getByRole('region', { name: 'Cómo pedir ayuda' }).locator('ol li')).toHaveCount(3)
  const video = page.locator('video.video-player')
  await expect(video).toHaveAttribute('src', '/sitio/ISTMO-capacitacion.mp4')
  for (const archivo of ['/sitio/ISTMO-capacitacion.mp4', '/sitio/ISTMO-capacitacion-poster.jpg']) {
    const r = await request.head(archivo)
    expect(r.ok(), archivo).toBe(true)
  }
  await expect(page.getByRole('region', { name: 'Guías en PDF' }).locator('.doc-row')).toHaveCount(2)
  await expect(page.getByRole('region', { name: 'Contacto' })).toContainText('506-6789')
  await expect(page.getByRole('region', { name: 'Contacto' }).getByRole('link', { name: 'CAUdnc@mef.gob.pa' })).toBeVisible()
  await expect(page.locator('main a[href*="intranet.mupa.gob.pa"]')).toHaveCount(0)
})

test('Documentos: Reglamento y Código de Ética tienen su lugar; Equiparación de Oportunidades espera los archivos de RRHH', async ({ page }) => {
  await page.goto('/documentos')
  const tarjeta = (t: string) => page.locator('.doc-card', { hasText: t })
  await expect(tarjeta('Código de Ética').getByRole('link', { name: /Abrir/ })).toBeVisible()
  // El Reglamento se muestra normal (vigencia confirmada por Daniel, 21-oct-2026).
  await expect(tarjeta('Reglamento Interno de Personal')).not.toContainText(/Pendiente|Por confirmar/)
  // Equiparación: el lugar existe, sin enlace ni PDF de relleno.
  const equip = tarjeta('Equiparación de Oportunidades')
  await expect(equip).toContainText('Próximamente')
  await expect(equip.locator('a')).toHaveCount(0)
  await page.getByRole('button', { name: /^Equiparación de Oportunidades/ }).click()
  await expect(page).toHaveURL(/cat=Equiparaci/)
  await expect(page.locator('.doc-card')).toHaveCount(1)
})

test('Documentos: la búsqueda y la categoría quedan en la dirección; sin resultados ofrece ver todos', async ({ page }) => {
  await page.goto('/documentos')
  const cuenta = page.locator('.docs-bar .count-note')
  const total = Number((await cuenta.innerText()).split(' de ')[1].split(' ')[0])
  await page.getByRole('button', { name: /^Reglamentos/ }).click()
  await expect(page).toHaveURL(/cat=Reglamentos/)
  await expect(page.locator('.doc-card .tagline').first()).toHaveText('Reglamentos')
  await page.getByLabel('Buscar documento').fill('zzz-no-existe')
  await expect(page.getByText('Aún no hay documentos con ese criterio')).toBeVisible()
  await page.getByRole('button', { name: 'Ver todos los documentos' }).click()
  await expect(cuenta).toHaveText(`${total} de ${total} documentos`)
  await expect(page).toHaveURL(/\/documentos$/)
})

test('Boletines: filtro por año, «Leer» dentro de la intranet y PDF en pestaña nueva', async ({ page }) => {
  await page.goto('/boletines?anio=2025')
  await expect(page.getByRole('button', { name: /^2025/ })).toHaveAttribute('aria-pressed', 'true')
  const n2025 = await page.locator('.bol-row').count()
  await page.getByRole('button', { name: /^Todos/ }).click()
  expect(await page.locator('.bol-row').count()).toBeGreaterThan(n2025)
  // «Leer» es la acción principal y abre el lector dentro de la intranet; el PDF suelto va en pestaña nueva.
  await expect(page.locator('.bol-row a', { hasText: 'Leer' }).first()).toHaveAttribute('href', /^\/boletines\/\d+$/)
  await expect(page.locator('.bol-row a', { hasText: 'Abrir PDF' }).first()).toHaveAttribute('target', '_blank')
  // Los PDF son copias locales y todos los boletines tienen el suyo.
  await expect(page.locator('.bol-row a', { hasText: 'Abrir PDF' }).first()).toHaveAttribute('href', /^\/sitio\//)
  await expect(page.locator('.bol-row', { hasText: 'PDF no disponible' })).toHaveCount(0)
})

test('Medicamentos: la búsqueda abre los grupos que coinciden y sin resultados avisa', async ({ page }) => {
  await page.goto('/clinica-medicamentos')
  await expect(page.locator('details.acc[open]')).toHaveCount(1)
  await page.getByLabel('Buscar medicamento').fill('insulina')
  await expect(page.locator('details.acc')).toHaveCount(1)
  await expect(page.locator('details.acc[open] li')).toHaveCount(3)
  await expect(page.locator('.toolbar .count-note')).toHaveText(/^3 de \d+ medicamentos/)
  await expect(page).toHaveURL(/q=insulina/)
  await page.getByLabel('Buscar medicamento').fill('zzz')
  await expect(page.getByText('Ningún medicamento coincide con la búsqueda.')).toBeVisible()
})

test('la Clínica muestra al personal (ficticio en esta copia, con sus iniciales) y sus migas no pasan por RRHH', async ({ page }) => {
  await page.goto('/clinica-medicamentos')
  await expect(page.locator('.crumbs a')).toHaveText(['Inicio', 'Clínica Municipal'])
  await page.locator('.crumbs').getByRole('link', { name: 'Clínica Municipal' }).click()
  await expect(page).toHaveURL(/\/clinica$/)
  await expect(page.locator('.cl-per')).toHaveCount(7)
  await expect(page.locator('.cl-per img')).toHaveCount(0)
  await expect(page.locator('.cl-per__ini').first()).toHaveText('AE')
})

test('Directorio: búsqueda y dirección en la URL; el buscador del Inicio llega sin recargar', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => ((window as unknown as { __spa: number }).__spa = 1))
  const bloque = page.locator('.dir-find')
  // Una extensión: sale una sola fila.
  await bloque.getByRole('searchbox').fill(unica.ext)
  await bloque.getByRole('button', { name: 'Buscar' }).click()
  await expect(page).toHaveURL(new RegExp(`/directorio\\?q=${unica.ext}$`))
  expect(await page.evaluate(() => (window as unknown as { __spa?: number }).__spa)).toBe(1)
  await expect(page.getByLabel('Buscar en el directorio')).toHaveValue(unica.ext)
  await expect(page.locator('table.ds-table tbody tr')).toHaveCount(1)
  await expect(page.locator('table.ds-table tbody tr')).toContainText(unica.apellido)

  await page.getByLabel('Buscar en el directorio').fill('')
  await page.getByLabel('Filtrar por dirección').selectOption('Recursos Humanos')
  await expect(page).toHaveURL(/dir=Recursos\+Humanos/)
  const deRrhh = PERSONAS.filter((p) => p.direccion === 'Recursos Humanos').length
  await expect(page.locator('table.ds-table tbody tr')).toHaveCount(Math.min(40, deRrhh))
  await expect(page.locator('.toolbar .count-note')).toContainText(`de ${deRrhh}`)
})

test('Directorio: 40 filas con «Ver más»; la búsqueda recorre todo el directorio y al cambiar el filtro vuelve a la primera página', async ({ page }) => {
  await page.goto('/directorio')
  await expect(page.locator('.dir-mesa')).toBeVisible()
  // El buscador va arriba, antes de las cifras y de las extensiones clave; la Mesa de Servicios, a la vista.
  const orden = await page.evaluate(() => {
    const y = (s: string) => document.querySelector(s)?.getBoundingClientRect().top ?? -1
    return { buscar: y('.toolbar .find'), mesa: y('.dir-mesa'), cifras: y('.stat-strip'), claves: y('#h-ext') }
  })
  expect(orden.buscar).toBeLessThan(orden.mesa)
  expect(orden.mesa).toBeLessThan(orden.cifras)
  expect(orden.cifras).toBeLessThan(orden.claves)
  await expect(page.locator('.dir-mesa')).toContainText('Mesa de Servicios')
  await expect(page.locator('.dir-mesa')).toContainText('ext. 1400')

  const filas = page.locator('table.ds-table tbody tr')
  await expect(filas).toHaveCount(40)
  await expect(page.locator('.toolbar .count-note')).toContainText(`Mostrando 40 de ${PERSONAS.length}`)
  await page.getByRole('button', { name: /^Ver más/ }).click()
  await expect(filas).toHaveCount(80)
  // Un filtro reinicia la página; la búsqueda encuentra a alguien que no estaba entre las filas visibles.
  await page.getByLabel('Buscar en el directorio').fill(unica.ext)
  await expect(filas).toHaveCount(1)
  await expect(page.getByRole('button', { name: /^Ver más/ })).toHaveCount(0)
  await page.getByLabel('Buscar en el directorio').fill('')
  await expect(filas).toHaveCount(40)
})

test('Noticias: filtro por tipo', async ({ page, request }) => {
  // Los datos iniciales no traen noticias: Comunicación publica una de cada tipo.
  await api(request, 'comunicacion')
  const sello = Date.now()
  const ids: number[] = []
  for (const type of ['noticia', 'tip']) {
    const r = await request.post('/api/news', { data: { title: `Filtro ${type} ${sello}`, type, date: '2026-09-01', status: 'publicado' } })
    expect(r.ok()).toBeTruthy()
    ids.push((await r.json()).id)
  }
  try {
    await page.goto('/noticias')
    await page.getByRole('button', { name: /^Noticias/ }).click()
    await expect(page).toHaveURL(/tipo=noticia/)
    await expect(page.getByText(`Filtro noticia ${sello}`)).toBeVisible()
    await expect(page.getByText(`Filtro tip ${sello}`)).toHaveCount(0)
  } finally {
    for (const id of ids) await request.delete(`/api/news/${id}`)
  }
})

test('Noticias: con un solo tipo no se ofrece el filtro (todas son noticias)', async ({ page, request }) => {
  await api(request, 'comunicacion')
  const r = await request.post('/api/news', { data: { title: `Solo noticia ${Date.now()}`, type: 'noticia', date: '2026-09-01', status: 'publicado' } })
  expect(r.ok()).toBeTruthy()
  const { id } = await r.json()
  try {
    await page.goto('/noticias')
    await expect(page.locator('.vista-bloques .doc-row').first()).toBeVisible()
    await expect(page.getByRole('group', { name: 'Filtrar por tipo' })).toHaveCount(0)
  } finally {
    await request.delete(`/api/news/${id}`)
  }
})

test('contador de boletines nuevos: aparece, se limpia al abrir Boletines y sigue limpio', async ({ page }) => {
  // Fecha fija: el 2026-09-01 hay boletines de los últimos 90 días (los datos llegan al 2026-08-05).
  await page.clock.setFixedTime(new Date(2026, 8, 1, 10))
  await page.goto('/')
  const contador = page.locator('#sidebar [data-group="documentos"] .count').first()
  await expect(contador).toBeVisible()
  expect(Number(await contador.innerText())).toBeGreaterThan(0)
  await page.goto('/boletines')
  // Primero que la página cargue: mientras dice "Cargando la intranet…" no hay menú y el contador "no está".
  await expect(page.locator('#sidebar')).toBeVisible()
  await expect(page.locator('#sidebar .count')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => localStorage.getItem('mupa_bol_seen'))).not.toBeNull()
  await page.goto('/')
  await expect(page.locator('#homeGrid > .home-w').first()).toBeVisible()
  await expect(page.locator('#sidebar .count')).toHaveCount(0)
})

test('Directorio: sin copia de la central muestra los datos fijos sin fecha; con copia, solo esas extensiones y «Actualizado hace …»', async ({ page }) => {
  await page.goto('/directorio')
  await expect(page.locator('.toolbar .count-note')).toContainText(`de ${PERSONAS.length}`)
  await expect(page.locator('.dir-actualizado')).toHaveCount(0)

  // La central simulada: la API ya dejó fuera las extensiones que no existen en ella.
  const copia = [...PERSONAS.slice(0, 3), { nombre: 'Bocina 1', apellido: '', direccion: '', ext: '3001', ubicacion: '', soloBusqueda: true }]
  await page.route('**/api/directory', (r) =>
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ personas: copia, actualizadoEn: new Date(Date.now() - 2 * 3_600_000).toISOString(), fuente: 'central' }) }),
  )
  await page.reload()
  await expect(page.locator('.dir-actualizado')).toHaveText('Actualizado hace 2 horas con la central telefónica.')
  // Los equipos (bocinas…) no salen en la lista, solo al buscarlos.
  await expect(page.locator('table.ds-table tbody tr')).toHaveCount(3)
  await page.getByLabel('Buscar en el directorio').fill('bocina')
  await expect(page.locator('table.ds-table tbody tr')).toHaveCount(1)
  await page.getByLabel('Buscar en el directorio').fill('')

  // Si la API falla, quedan los datos fijos.
  await page.route('**/api/directory', (r) => r.fulfill({ status: 500, body: '' }))
  await page.reload()
  await expect(page.locator('table.ds-table tbody tr')).toHaveCount(40)
  await expect(page.locator('.dir-actualizado')).toHaveCount(0)
})
