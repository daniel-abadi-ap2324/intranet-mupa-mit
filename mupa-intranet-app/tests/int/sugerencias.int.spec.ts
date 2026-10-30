/**
 * La búsqueda del Inicio con los datos iniciales REALES (catálogo y formularios del
 * seed de la API): cada sugerencia de "Lo más buscado" tiene que encontrar algo.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { DIRECTORIO } from '@/data/directorio'
import { agrupar, buscar, indiceBusqueda } from '@/lib/busqueda'
import type { App } from '@/lib/catalogo'
import type { Noticia } from '@/lib/contenido'
import type { Formulario } from '@/lib/formularios'
import { SUGERENCIAS } from '@/lib/sugerencias'

const seed = (archivo: string) =>
  JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../mupa-intranet-api/src/database/seed-data', archivo), 'utf8'))

type AppJson = { id: string; nombre: string; descripcion: string; categoria: string; etiquetas: string[]; url?: string; estado: string; palabras?: string; icono?: string }
const apps: App[] = (seed('aplicaciones.json').aplicaciones as AppJson[])
  .filter((a) => a.estado !== 'Oculto')
  .map((a) => ({ id: a.id, name: a.nombre, desc: a.descripcion, cat: a.categoria, g: a.icono || '▦', h: a.url || null, tags: a.etiquetas, k: a.palabras || '', confirmado: true }))
const formularios = seed('formularios.json') as Formulario[]
const noticias: Noticia[] = [{ id: 1, fecha: '2026-09-20', t: 'Jornada de vacunación en el Palacio', tipo: 'noticia', meta: 'Recursos Humanos', h: null, img: null }]
const indice = indiceBusqueda(apps, [], formularios, { personas: DIRECTORIO.personas, noticias })

describe('"Lo más buscado" (sugerencias del Inicio)', () => {
  it.each(SUGERENCIAS)('«%s» encuentra resultados', (s) => {
    expect(buscar(indice, s, 'todo', 500).hits.length).toBeGreaterThan(0)
  })
})

describe('búsqueda del Inicio', () => {
  it('encuentra personas del directorio y noticias', () => {
    const p = DIRECTORIO.personas.find((x) => x.apellido)!
    const personas = buscar(indice, p.apellido, 'people').hits
    expect(personas[0]).toMatchObject({ kind: 'Persona', h: '/directorio?q=' + encodeURIComponent(p.nombre + ' ' + p.apellido) })
    expect(buscar(indice, 'vacunación', 'news').hits[0]).toMatchObject({ kind: 'Noticia', h: '/noticias' })
  })

  it('agrupa en el orden de las categorías y sin grupos vacíos', () => {
    const grupos = agrupar(buscar(indice, 'carpetas', 'todo', 500).hits)
    const ids = grupos.map((g) => g.id)
    expect(ids).toContain('forms')
    expect(grupos.every((g) => g.items.length > 0)).toBe(true)
    const orden = ['apps', 'forms', 'people', 'docs', 'news', 'pages', 'links']
    expect([...ids].sort((a, b) => orden.indexOf(a) - orden.indexOf(b))).toEqual(ids)
  })
})

/** Las consultas que dieron vacío o ruido en la auditoría (oct-2026): ahora buscan por raíz y por inicio de palabra. */
describe('consultas de la auditoría', () => {
  const primeros = (q: string, n = 3) => buscar(indice, q, 'todo').hits.slice(0, n).map((r) => r.t)

  it('«extensión de la Mesa de Servicios» → Mesa de Servicios', () => {
    expect(primeros('extensión de la Mesa de Servicios', 2).join(' | ')).toMatch(/Mesa de Servicios/)
  })
  it('«cómo pido un código de llamadas» → Códigos de llamadas', () => {
    expect(primeros('cómo pido un código de llamadas', 1)).toEqual(['Códigos de llamadas'])
  })
  it('«directorio tesorería» → el Directorio, con lo de Tesorería', () => {
    const t = buscar(indice, 'directorio tesorería', 'todo', 500).hits
    expect(t.length).toBeGreaterThan(0)
    expect(t.some((r) => r.h === '/directorio')).toBe(true)
  })
  it.each(['comprobante de pago', 'marcaciones', 'nómina'])('«%s» → Recursos Humanos / RRHH Express', (q) => {
    const t = buscar(indice, q, 'todo').hits.slice(0, 3)
    expect(t.some((r) => r.h === '/recursos-humanos' || /RRHH Express/.test(r.t))).toBe(true)
  })
  it('«organigrama» → Directorio', () => {
    expect(buscar(indice, 'organigrama', 'todo').hits[0].h).toBe('/directorio')
  })
  it('«ARI» pone la aplicación ARI primero y no trae a Ariadna ni a Boletines', () => {
    const t = buscar(indice, 'ARI', 'todo', 500).hits
    expect(t[0].t).toBe('ARI')
    expect(t.some((r) => /Ariadna|Bolet|Gestión Social/.test(r.t))).toBe(false)
  })
  it('«clinica» no pone a «Clinica Veterinaria» antes que la Clínica Municipal', () => {
    const t = buscar(indice, 'clinica', 'todo').hits.map((r) => r.t)
    expect(t[0]).not.toMatch(/Veterinaria/)
  })
  it('plurales y verbos: «códigos», «comprobantes»', () => {
    expect(buscar(indice, 'códigos', 'todo').hits.length).toBeGreaterThan(0)
    expect(buscar(indice, 'comprobantes', 'todo').hits.length).toBeGreaterThan(0)
  })
})
