/** Catálogo de endpoints para el servidor MCP (GET /api/meta/catalog): llave interna, completitud y forma. */
import { existsSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { ENDPOINT_DOCS } from '../src/features/meta/endpoint-docs.ts'
import { anonymous, createUser, loginAs } from './helpers.ts'

const KEY = process.env.MCP_INTERNAL_KEY!
type Endpoint = { id: string; method: string; path: string; area: string | null; summary: string | null; accessLevel: string; roles: string[]; access: string; page: string | null; request: { params?: { properties?: Record<string, unknown> }; query?: { properties?: Record<string, unknown> }; body?: { properties?: Record<string, unknown> } } }
type Catalog = { version: number; edition: string; endpoints: Endpoint[]; pages: { path: string; title: string; about: string }[]; facts: string[] }

const pedir = async () => (await anonymous().get('/api/meta/catalog').set('X-Internal-Key', KEY)).body as Catalog

describe('llave interna', () => {
  it('sin llave o con otra, no entra', async () => {
    expect((await anonymous().get('/api/meta/catalog')).status).toBe(401)
    expect((await anonymous().get('/api/meta/catalog').set('X-Internal-Key', 'otra-llave-que-no-es-la-buena')).status).toBe(401)
    expect((await anonymous().get('/api/meta/catalog').set('X-Internal-Key', KEY.slice(0, -1))).status).toBe(401)
  })

  it('una sesión de administración sin la llave tampoco: es para el servicio, no para personas', async () => {
    await createUser('admin-meta@prueba.test', ['admin'])
    const admin = await loginAs('admin-meta@prueba.test')
    expect((await admin.get('/api/meta/catalog')).status).toBe(401)
  })

  it('con la llave devuelve el catálogo', async () => {
    const r = await anonymous().get('/api/meta/catalog').set('X-Internal-Key', KEY)
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ version: 1, edition: 'completa' })
    expect(r.headers['cache-control']).toBe('no-store')
  })
})

describe('el catálogo describe TODOS los endpoints', () => {
  it('cada ruta montada tiene su descripción y área', async () => {
    const { endpoints } = await pedir()
    expect(endpoints.length).toBeGreaterThan(80)
    const sinDoc = endpoints.filter((e) => !e.summary || !e.area).map((e) => e.id)
    // Si falla: agrega la ruta a src/features/meta/endpoint-docs.ts.
    expect(sinDoc).toEqual([])
  })

  it('no sobra ninguna descripción (una ruta que se quitó o cambió de nombre)', async () => {
    const { endpoints } = await pedir()
    const ids = new Set(endpoints.map((e) => e.id))
    expect(Object.keys(ENDPOINT_DOCS).filter((id) => !ids.has(id))).toEqual([])
  })

  it('los ids no se repiten y son «MÉTODO /ruta»', async () => {
    const { endpoints } = await pedir()
    expect(new Set(endpoints.map((e) => e.id)).size).toBe(endpoints.length)
    for (const e of endpoints) {
      expect(e.id).toBe(`${e.method} ${e.path}`)
      expect(e.path.startsWith('/api/')).toBe(true)
    }
  })

  it('los roles salen de la ruta misma, no de lo escrito a mano', async () => {
    const { endpoints } = await pedir()
    const por = (id: string) => endpoints.find((e) => e.id === id)!
    expect(por('POST /api/bulletins')).toMatchObject({ accessLevel: 'roles', roles: ['admin', 'comunicacion'] })
    expect(por('POST /api/applications')).toMatchObject({ accessLevel: 'roles', roles: ['admin'] })
    expect(por('GET /api/requests/mine')).toMatchObject({ accessLevel: 'session', roles: [] })
    expect(por('GET /api/bulletins')).toMatchObject({ accessLevel: 'open', access: 'Cualquiera' })
    // Lo que pide un rol dice cuáles; lo que pide una cuenta conectada lo dice en su descripción.
    expect(por('GET /api/gestion/panel').access).toContain('gestorSolicitudes')
    expect(por('GET /api/rrhh/marcaciones').access).toContain('RRHH Express')
  })

  it('lo que cada endpoint recibe sale de sus DTO (JSON Schema)', async () => {
    const { endpoints } = await pedir()
    const por = (id: string) => endpoints.find((e) => e.id === id)!
    expect(Object.keys(por('GET /api/bulletins').request.query!.properties!)).toEqual(['q'])
    expect(Object.keys(por('POST /api/bulletins').request.body!.properties!)).toEqual(expect.arrayContaining(['date', 'pdfUrl', 'published']))
    expect(por('PATCH /api/news/:id').request.params!.properties).toHaveProperty('id')
    expect(por('GET /api/health').request).toEqual({})
  })

  it('las páginas de RRHH que citan los endpoints existen en el asistente', async () => {
    const c = await pedir()
    const paginas = new Set(c.pages.map((p) => p.path))
    for (const e of c.endpoints.filter((x) => x.page?.startsWith('/recursos-humanos?'))) expect(paginas.has(e.page!)).toBe(true)
  })

  it('lleva las páginas y los datos confirmados del asistente', async () => {
    const c = await pedir()
    expect(c.pages.find((p) => p.path === '/boletines')).toMatchObject({ title: expect.stringContaining('Boletines') })
    expect(c.pages.every((p) => p.title && p.about)).toBe(true)
    expect(c.facts.some((f) => f.includes('1400'))).toBe(true)
  })
})

describe('copia de respaldo del MCP (mupa-intranet-mcp/catalog.snapshot.json)', () => {
  it('trae los mismos endpoints y páginas que la API (si no, corre `npm run catalogo:exportar`)', async () => {
    const archivo = new URL('../../mupa-intranet-mcp/catalog.snapshot.json', import.meta.url)
    if (!existsSync(archivo)) return // la API sola (sin el MCP al lado), p. ej. en su imagen de Docker
    const copia = JSON.parse(readFileSync(archivo, 'utf8')) as Catalog
    const actual = await pedir()
    expect(copia.endpoints.map((e) => e.id).sort()).toEqual(actual.endpoints.map((e) => e.id).sort())
    expect(copia.pages.map((p) => p.path).sort()).toEqual(actual.pages.map((p) => p.path).sort())
    // Y con las mismas descripciones: un cambio en endpoint-docs.ts también pide volver a exportar.
    expect(Object.fromEntries(copia.endpoints.map((e) => [e.id, e.summary]))).toEqual(Object.fromEntries(actual.endpoints.map((e) => [e.id, e.summary])))
  })
})
