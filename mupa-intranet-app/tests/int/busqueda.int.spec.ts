import { describe, expect, it } from 'vitest'

import { buscar, indiceBusqueda, type Resultado } from '@/lib/busqueda'
import type { App } from '@/lib/catalogo'

const indice: Resultado[] = [
  { t: 'Trámites', meta: 'Área', kind: 'Área', h: '/aplicaciones?area=Tr%C3%A1mites' },
  { t: 'Solicitud de Carta de Trabajo', meta: 'Recursos Humanos', kind: 'Formulario', h: '/formularios/carta-de-trabajo', k: 'carta' },
  { t: 'Correo institucional', meta: 'Outlook', kind: 'Sistema', h: 'https://correo.ejemplo.gob.pa', k: 'email' },
  { t: 'Manual de correo', meta: 'Manuales', kind: 'Documento', h: '/sitio/manual.pdf' },
]

describe('buscar()', () => {
  it('sin texto, en "Todo" muestra las áreas para explorar', () => {
    expect(buscar(indice, '', 'todo').hits.map((r) => r.kind)).toEqual(['Área'])
  })

  it('ignora tildes y mayúsculas, y pone primero lo que empieza con lo escrito', () => {
    const { hits, conteos } = buscar(indice, 'CORREO', 'todo')
    expect(hits.map((r) => r.t)).toEqual(['Correo institucional', 'Manual de correo'])
    expect(conteos).toMatchObject({ todo: 2, apps: 1, docs: 1, forms: 0 })
    expect(buscar(indice, 'tramites', 'todo').hits[0].t).toBe('Trámites')
  })

  it('filtra por categoría y respeta el límite', () => {
    expect(buscar(indice, 'correo', 'docs').hits.map((r) => r.t)).toEqual(['Manual de correo'])
    expect(buscar(indice, 'co', 'todo', 2).hits).toHaveLength(2)
  })
})

describe('indiceBusqueda(): un resultado por destino', () => {
  const app = (name: string, h: string | null): App => ({ id: name.toLowerCase(), name, desc: 'Ficticia', cat: 'Soporte', g: '▦', h, tags: [], k: '', confirmado: true })

  it('la sección del menú gana a la aplicación que lleva al mismo lugar, y se sigue encontrando por el nombre de la app', () => {
    const idx = indiceBusqueda([app('Directorio telefónico', '/directorio'), app('Sin enlace A', null), app('Sin enlace B', null)], [], [])
    expect(idx.filter((r) => r.h === '/directorio').map((r) => [r.t, r.kind])).toEqual([['Directorio', 'Sección']])
    expect(buscar(idx, 'directorio telefonico', 'todo').hits[0].t).toBe('Directorio')
    // Las aplicaciones sin enlace (llevan al catálogo) no se cuentan como repetidas.
    expect(idx.filter((r) => r.t.startsWith('Sin enlace'))).toHaveLength(2)
  })

  it('la afiliación a pagos por ACH (ahora en Recursos Humanos) se sigue encontrando', () => {
    const idx = indiceBusqueda([], [], [])
    expect(buscar(idx, 'ach', 'todo').hits[0]).toMatchObject({ t: 'Afiliación a pagos por ACH', kind: 'PDF' })
    expect(idx.filter((r) => /ACH/.test(r.t))).toHaveLength(1)
  })

  it('la Clínica es un destino propio: sus páginas no dicen "Recursos Humanos"', () => {
    const idx = indiceBusqueda([], [], [])
    expect(idx.find((r) => r.h === '/clinica')).toMatchObject({ kind: 'Sección', meta: 'Destino principal' })
    expect(idx.filter((r) => r.kind === 'Clínica').every((r) => r.meta === 'Clínica Municipal')).toBe(true)
    expect(buscar(idx, 'clinica', 'todo').hits.some((r) => r.t === 'Recursos Humanos')).toBe(false)
  })
})
