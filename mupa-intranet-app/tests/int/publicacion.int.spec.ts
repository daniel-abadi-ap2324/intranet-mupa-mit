/**
 * Edición publicación (VITE_EDICION=publicacion): lo apagado no aparece en rutas,
 * menú ni Inicio, y lo que queda funciona. Los módulos leen la edición al cargarse:
 * se vuelven a importar con la variable puesta.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { App } from '@/lib/catalogo'

const seed = (archivo: string) =>
  JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../mupa-intranet-api/src/database/seed-data', archivo), 'utf8'))

let E: typeof import('@/lib/edicion')
let M: typeof import('@/lib/menu')
let B: typeof import('@/lib/bloques')
let S: typeof import('@/lib/sugerencias')
let Q: typeof import('@/lib/busqueda')
let D: typeof import('@/data/directorio')

beforeAll(async () => {
  vi.stubEnv('VITE_EDICION', 'publicacion')
  vi.resetModules()
  ;[E, M, B, S, Q, D] = await Promise.all([import('@/lib/edicion'), import('@/lib/menu'), import('@/lib/bloques'), import('@/lib/sugerencias'), import('@/lib/busqueda'), import('@/data/directorio')])
})
afterAll(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

const OCULTAS = [
  '/videos', '/gestion/anuncios', '/gestion/videos', '/gestion/inicio',
  // Copia de la VM: formularios internos, su constructor, la bandeja y el detalle de una solicitud interna.
  // Recursos Humanos, quitada el 29-oct-2026 hasta revisar RRHH Express.
  '/recursos-humanos', '/recursos-humanos?seccion=comprobantes',
  '/formularios', '/formularios/codigo-de-impresion', '/gestion/formularios', '/gestion/formularios/2', '/gestion/solicitudes', '/gestion/solicitudes/5', '/mis-solicitudes/3',
]
const VISIBLES = ['/noticias', '/gestion/noticias', '/mis-solicitudes', '/', '/aplicaciones', '/directorio?q=ana', '/documentos', '/manuales', '/mesa-servicios#videos', '/clinica', '/gestion/usuarios', '/gestion/departamentos', '/gestion/aplicaciones', '/boletines', '/gestion/boletines', '/sitio/x.pdf', 'https://www.gacetaoficial.gob.pa']

describe('edición publicación', () => {
  it('apaga anuncios, videos, el contenido del Inicio, los formularios internos, su bandeja y los «Próximamente»; noticias, boletines y Mis solicitudes van', () => {
    expect(E.EDICION).toBe('publicacion')
    for (const f of ['anuncios', 'videos', 'gestionInicio', 'formularios', 'bandeja', 'proximamente', 'recursosHumanos'] as const) expect(E.activa(f), f).toBe(false)
    for (const f of ['noticias', 'boletines', 'solicitudes'] as const) expect(E.activa(f), f).toBe(true)
    for (const r of OCULTAS) expect(E.rutaVisible(r), r).toBe(false)
    for (const r of VISIBLES) expect(E.rutaVisible(r), r).toBe(true)
  })

  it('el menú, el pie y la gestión no llevan a nada apagado', () => {
    const todos = [...M.MENU.flatMap((m) => [m, ...(m.children || [])]), ...M.MENU_SESION, ...M.PIE_MENU, ...M.MENU_GESTION]
    for (const it of todos) expect(E.rutaVisible(it.h), it.h).toBe(true)
    expect(M.MENU_SESION.map((m) => m.id)).toEqual(['mis-solicitudes'])
    expect(M.MENU_GESTION.map((g) => g.id)).toEqual(['gestion-centro', 'gestion-noticias', 'gestion-boletines', 'gestion-marca', 'gestion-usuarios', 'gestion-departamentos', 'gestion-aplicaciones'])
    // Comunicación: el Centro de Gestión (con lo publicado), noticias, boletines y la página de marca.
    expect(M.gestionDe({ roles: ['comunicacion'] }).flatMap((g) => g.items.map((i) => i.id))).toEqual(['gestion-centro', 'gestion-noticias', 'gestion-boletines', 'gestion-marca'])
    expect(M.gestionDe({ roles: ['admin'] }).map((g) => g.grupo)).toEqual(['General', 'Contenido', 'Administración'])
  })

  it('el Inicio no tiene bloques de lo apagado ni las cifras o las campañas, y el diseño por defecto llena cada fila', () => {
    for (const id of ['anuncios', 'videos', 'indicadores', 'campanas']) expect(B.BLOQUES[id], id).toBeUndefined()
    expect(B.BLOQUES.noticias).toBeDefined()
    expect(B.BLOQUES.solicitudes).toBeDefined()
    expect(B.BLOQUES.formularios).toBeUndefined()
    const d = B.disenoPorDefecto()
    expect(d.items.map((x) => x.id)).toEqual(['accesos', 'directorio', 'mesa', 'solicitudes', 'noticias', 'boletines', 'clinica', 'frecuentes', 'enlaces', 'marca'])
    const columnas = { tercio: 4, media: 6, 'dos-tercios': 8, completa: 12 }
    expect(d.items.reduce((n, x) => n + columnas[x.ancho], 0) % 12).toBe(0)
    // Un diseño guardado con bloques apagados los descarta sin romperse.
    expect(B.limpiarDiseno({ items: [{ id: 'anuncios' }, { id: 'accesos' }, { id: 'campanas' }] })!.items.map((x) => x.id)).toEqual(['accesos'])
  })

  it('cada sugerencia de "Lo más buscado" encuentra algo, sin formularios ni noticias', () => {
    type AppJson = { id: string; nombre: string; descripcion: string; categoria: string; etiquetas: string[]; url?: string; urlPrototipo?: string; estado: string; palabras?: string }
    // Como el seeder de la API: las páginas del prototipo (x.html) pasan a rutas de la SPA.
    const ruta = (a: AppJson) => {
      const p = a.urlPrototipo
      if (p && /^formulario\.html\?f=/.test(p)) return '/formularios/' + p.split('=')[1]
      if (p && /\.html$/.test(p)) return '/' + p.replace('.html', '')
      return a.url || null
    }
    const apps: App[] = (seed('aplicaciones.json').aplicaciones as AppJson[])
      .filter((a) => a.estado !== 'Oculto')
      .map((a) => ({ id: a.id, name: a.nombre, desc: a.descripcion, cat: a.categoria, g: '▦', h: ruta(a), tags: a.etiquetas, k: a.palabras || '', confirmado: true }))
      .filter((a) => E.rutaVisible(a.h))
    const enlaces = seed('contenido-inicio.json').enlaces
    const indice = Q.indiceBusqueda(apps, enlaces, [], { personas: D.DIRECTORIO.personas, noticias: [] })
    for (const s of S.SUGERENCIAS) expect(Q.buscar(indice, s, 'todo', 500).hits.length, s).toBeGreaterThan(0)
    // Lo que se pedía en la intranet actual se encuentra con las palabras de la gente, en cualquier orden.
    for (const [q, t] of [['solicitar internet', 'Acceso a la red WIFI'], ['wifi', 'Acceso a la red WIFI'], ['código de llamadas', 'Códigos de llamadas'], ['instructivo clínica', 'Instructivo del sistema de la Clínica']])
      expect(Q.buscar(indice, q, 'todo', 500).hits.map((h) => h.t), q).toContain(t)
    for (const r of indice) expect(E.rutaVisible(r.h), r.h).toBe(true)
  })

  it('Recursos Humanos y Documentos no muestran filas «Próximamente» ni nada que mande a lo apagado', async () => {
    const R = await import('@/data/rrhh')
    const Dc = await import('@/data/documentos')
    expect(R.INFORMACION_RRHH.every((x) => x.h), 'Información de RRHH sin h: null').toBe(true)
    expect(R.INFORMACION_RRHH.map((x) => x.t)).toEqual(['Reglamento Interno', 'Código de Ética']) // la Clínica tiene su propio lugar en el menú
    // «Cómo solicitar»: solo lo que redirige (el PDF del ACH, RRHH Express); el resto es una frase.
    expect(R.SE_SOLICITAN_EN_RRHH).toContain('Carta de trabajo')
    expect(R.COMO_SOLICITAR_RRHH.every((x) => x.h || x.seccion)).toBe(true)
    for (const x of [...R.INFORMACION_RRHH, ...R.COMO_SOLICITAR_RRHH]) expect(E.rutaVisible(x.h), x.t).toBe(true)
    expect(Dc.DOCUMENTOS.some((d) => !d.h)).toBe(true) // el dato sigue en el código; la página lo oculta con activa('proximamente')
  })
})
