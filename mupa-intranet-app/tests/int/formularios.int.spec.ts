import { describe, expect, it } from 'vitest'

import {
  activos,
  agregarItem,
  alternarCasilla,
  claves,
  contarCampos,
  conValor,
  errorDe,
  errores,
  estadoInicial,
  progreso,
  quitarItem,
  resumen,
  seccionesVisibles,
  type Campo,
  type Estado,
  type Formulario,
} from '@/lib/formularios'

import JSON_FORMULARIOS from '../../../mupa-intranet-api/src/database/seed-data/formularios.json'

/** Los 7 formularios del sitio actual (código de llamadas y WIFI van por su propio sistema), como llegan de la API (el seed los carga desde ese JSON). */
const FORMULARIOS = (JSON_FORMULARIOS as unknown as (Omit<Formulario, 'area' | 'destino' | 'recibe'> & { area: string })[]).map((f) => ({ ...f, destino: '', recibe: false }))
const porSlug = (s: string) => FORMULARIOS.find((f) => f.slug === s)

const TIPOS = ['text', 'email', 'tel', 'cedula', 'number', 'textarea', 'select', 'radio', 'checks', 'repeat']
const form = (s: string) => porSlug(s)!
/** Ruta del campo con esa etiqueta entre los que están en juego (la primera). */
const ruta = (slug: string, e: Estado, l: string) => activos(form(slug), e).find((x) => x.campo.l === l)!.ruta

describe('los 7 formularios del sitio actual (seed de la API)', () => {
  it('son 7 y sus slugs no se repiten', () => {
    expect(FORMULARIOS).toHaveLength(7)
    expect(new Set(FORMULARIOS.map((f) => f.slug)).size).toBe(7)
  })

  it.each(FORMULARIOS.map((f) => [f.slug, f]))('%s cumple la forma que espera el componente', (_s, f) => {
    const radios = f.sections.flatMap((s) => s.fields).filter((c) => c.t === 'radio')
    const revisar = (campos: Campo[], seccion: number) => {
      expect(new Set(claves(campos)).size).toBe(campos.length)
      for (const c of campos) {
        expect(TIPOS).toContain(c.t)
        expect(c.l.trim()).not.toBe('')
        if (c.t === 'radio' || c.t === 'select') expect(c.opts?.length).toBeGreaterThan(0)
        if (c.auto) expect(seccion).toBe(0)
        if (c.t === 'checks') {
          expect(c.items?.length).toBeGreaterThan(0)
          c.items!.forEach((it) => it.sub && revisar(it.sub, seccion))
        }
        if (c.t === 'repeat') {
          expect(c.fields?.length).toBeGreaterThan(0)
          expect(c.min || 0).toBeLessThanOrEqual(c.max || 5)
          revisar(c.fields!, seccion)
        }
      }
    }
    f.sections.forEach((s, i) => {
      revisar(s.fields, i)
      if (s.show) {
        const r = radios.find((c) => c.k === s.show!.k)
        expect(r, 'show.k apunta a una opción única').toBeDefined()
        expect(r!.opts).toContain(s.show.v)
      }
    })
  })

  it('cuenta los campos como el prototipo', () => {
    expect(contarCampos(form('codigo-de-impresion'))).toBe(4)
    expect(contarCampos(form('internet-proveedores'))).toBe(11)
  })
})

describe('claves de los campos', () => {
  it('usan k o la etiqueta, y numeran las repetidas', () => {
    expect(claves([{ l: 'Nombre completo', t: 'text' }, { k: 'correo', l: 'Correo', t: 'email' }, { l: 'Nombre completo', t: 'text' }])).toEqual(['nombre-completo', 'correo', 'nombre-completo-2'])
  })

  it('son las mismas cada vez (sirven de id en la página)', () => {
    const a = activos(form('nuevo-funcionario'), estadoInicial(form('nuevo-funcionario'))).map((x) => x.ruta)
    const b = activos(form('nuevo-funcionario'), estadoInicial(form('nuevo-funcionario'))).map((x) => x.ruta)
    expect(a).toEqual(b)
    expect(new Set(a).size).toBe(a.length)
    for (const r of a) expect(r).toMatch(/^[a-z0-9_-]+$/)
  })
})

describe('estado inicial', () => {
  it('sin perfil no completa nada y crea el mínimo de ítems de cada lista', () => {
    const e = estadoInicial(form('internet-proveedores'))
    expect(e.v).toEqual({})
    expect(e.auto).toEqual([])
    expect(Object.values(e.i)).toEqual([[1]])
  })

  it('con perfil completa nombre y correo (solo lo que existe) en "Quién solicita"', () => {
    const f = form('codigo-de-impresion')
    const e = estadoInicial(f, { nombreCompleto: 'Lucía Herrera', correo: '' })
    expect(e.auto).toHaveLength(1)
    expect(e.v[e.auto[0]]).toBe('Lucía Herrera')
    expect(activos(f, e).find((x) => x.ruta === e.auto[0])!.seccion).toBe(0)
  })
})

describe('validación', () => {
  const c = (t: Campo['t'], extra: Partial<Campo> = {}): Campo => ({ l: 'Dato', t, ...extra })
  const con = (v: string): Estado => ({ v: { x: v }, c: {}, i: {}, sig: 1, auto: [] })

  it.each(['8-123-4567', 'PE-1-23', '1AV-1-1', 'e-8-123456', 'N-12-345'])('cédula válida: %s', (v) => expect(errorDe(c('cedula'), 'x', con(v))).toBe(''))
  it.each(['14-1-1', '8-12345-1', '8 123 4567', '81234567'])('cédula inválida: %s', (v) => expect(errorDe(c('cedula'), 'x', con(v))).toMatch(/guiones/))

  it('correo, teléfono y número', () => {
    expect(errorDe(c('email'), 'x', con('nombre@alcaldia.gob.pa'))).toBe('')
    expect(errorDe(c('email'), 'x', con('nombre@alcaldia'))).toMatch(/correo válido/)
    expect(errorDe(c('tel'), 'x', con('1400'))).toBe('')
    expect(errorDe(c('tel'), 'x', con('ext 1400'))).toMatch(/solo números/)
    const horas = c('number', { min: 1, max: 24 })
    expect(errorDe(horas, 'x', con('8'))).toBe('')
    expect(errorDe(horas, 'x', con('25'))).toMatch(/entre 1 y 24/)
    expect(errorDe(horas, 'x', con('1.5'))).toMatch(/entero/)
  })

  it('obligatorios vacíos, con el mensaje de cada tipo', () => {
    expect(errorDe(c('text', { r: true }), 'x', con('  '))).toBe('Completa «Dato».')
    expect(errorDe(c('radio', { r: true, opts: ['a'] }), 'x', con(''))).toBe('Elige una opción en «Dato».')
    expect(errorDe(c('checks', { r: true, items: [{ l: 'a' }] }), 'x', con(''))).toBe('Marca al menos una opción en «Dato».')
    // Un campo opcional vacío no tiene error.
    expect(errorDe(c('email'), 'x', con(''))).toBe('')
  })

  it('los errores salen en el orden de la página y el progreso los cuenta', () => {
    const f = form('codigo-de-impresion')
    const e = estadoInicial(f)
    expect(errores(f, e).map((x) => x.msg)[0]).toMatch(/^Completa «/)
    const p = progreso(f, e)
    expect(p.ok).toBe(0)
    expect(p.total).toBe(errores(f, e).length)
    expect(p.pasos[0].hecho).toBe(false)
    // Una sección sin obligatorios ya cuenta como completa (como en el prototipo).
    const sinObligatorios = p.pasos.filter((x) => !activos(f, e).some((n) => n.seccion === x.i && n.campo.r))
    for (const x of sinObligatorios) expect(x.hecho).toBe(true)
  })
})

describe('secciones condicionales, casillas y listas', () => {
  it('lista-de-difusion: la sección depende de la opción elegida', () => {
    const f = form('lista-de-difusion')
    let e = estadoInicial(f)
    const antes = seccionesVisibles(f, e).length
    const accion = activos(f, e).find((x) => x.campo.k === 'accion')!
    e = conValor(e, accion.ruta, 'Crear una lista nueva')
    const despues = seccionesVisibles(f, e)
    expect(despues.length).toBe(antes + 1)
    // Numeradas seguidas aunque haya secciones ocultas.
    expect(despues.map((s) => s.n)).toEqual(despues.map((_, k) => k + 1))
    expect(progreso(f, e).total).toBeGreaterThan(progreso(f, estadoInicial(f)).total)
  })

  it('nuevo-funcionario: marcar una casilla con sub-campos los suma', () => {
    const f = form('nuevo-funcionario')
    const e = estadoInicial(f)
    const grupo = activos(f, e).find((x) => x.campo.t === 'checks' && x.campo.items!.some((it) => it.sub))!
    const j = grupo.campo.items!.findIndex((it) => it.sub)
    const n = activos(f, e).length
    const e2 = alternarCasilla(e, grupo.ruta, j)
    expect(activos(f, e2).length).toBeGreaterThan(n)
    expect(activos(f, alternarCasilla(e2, grupo.ruta, j)).length).toBe(n)
  })

  it('internet-proveedores: agregar y quitar participantes, hasta 5', () => {
    const f = form('internet-proveedores')
    let e = estadoInicial(f)
    const lista = activos(f, e).find((x) => x.campo.t === 'repeat')!
    for (let k = 0; k < 4; k++) e = agregarItem(e, lista.campo, lista.ruta).estado
    expect(e.i[lista.ruta]).toHaveLength(5)
    expect(agregarItem(e, lista.campo, lista.ruta).id).toBeNull()

    // Lo escrito en el ítem 2 se va con él.
    const nombre2 = activos(f, e).filter((x) => x.campo.l === 'Nombre completo' && x.prefijo)[1].ruta
    e = conValor(e, nombre2, 'Visitante Dos')
    e = quitarItem(e, lista.ruta, e.i[lista.ruta][1])
    expect(e.i[lista.ruta]).toHaveLength(4)
    expect(Object.values(e.v)).not.toContain('Visitante Dos')
  })

  it('el resumen muestra "Participante 1 · …" y solo lo que tiene valor', () => {
    const f = form('internet-proveedores')
    let e = estadoInicial(f, { nombreCompleto: 'Lucía Herrera' })
    const nombre1 = activos(f, e).find((x) => x.prefijo === 'Participante 1 · ' && x.campo.l === 'Nombre completo')!.ruta
    e = conValor(e, nombre1, 'Visitante Uno')
    const r = resumen(f, e)
    expect(r[0]).toEqual({ titulo: 'Quién solicita', filas: [{ dt: 'Nombre completo', dd: 'Lucía Herrera' }] })
    expect(r.flatMap((s) => s.filas)).toContainEqual({ dt: 'Participante 1 · Nombre completo', dd: 'Visitante Uno' })
  })

  it('ruta() de ayuda encuentra campos por etiqueta', () => {
    const e = estadoInicial(form('codigo-de-impresion'))
    expect(ruta('codigo-de-impresion', e, activos(form('codigo-de-impresion'), e)[0].campo.l)).toMatch(/^s0_/)
  })
})
