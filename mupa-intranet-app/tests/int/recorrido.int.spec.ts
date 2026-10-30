import { describe, expect, it } from 'vitest'

import { debeMostrarse, PREGUNTA_EJEMPLO, pasosRecorrido, RUTA_ASISTENTE } from '@/lib/recorrido'

const base = { conSesion: false, gestion: false, movil: false, asistente: true }
const ids = (c: Partial<typeof base>) => pasosRecorrido({ ...base, ...c }).map((p) => p.id)

describe('pasosRecorrido', () => {
  it('sin sesión: invita a iniciar sesión; con sesión: la campana', () => {
    const sin = ids({})
    const con = ids({ conSesion: true })
    expect(sin).toEqual(['bienvenida', 'buscar', 'asistente', 'asistente-escribir', 'asistente-respuesta', 'menu', 'entrar', 'ayuda'])
    expect(con).toContain('avisos')
    expect(con).not.toContain('entrar')
  })

  it('panel de gestión solo para quien lo tiene; en el teléfono, el menú es el botón "Más"', () => {
    expect(ids({ conSesion: true, gestion: true })).toContain('gestion')
    expect(pasosRecorrido({ ...base, conSesion: true, movil: true }).find((p) => p.id === 'menu')!.objetivo).toBe('.app-menubtn')
  })

  it('el tramo del asistente lleva a /asistente, usa una pregunta de ejemplo sin datos personales y va seguido en el recorrido', () => {
    const todos = pasosRecorrido({ ...base, conSesion: true })
    const en = todos.filter((p) => p.ruta === RUTA_ASISTENTE).map((p) => p.id)
    expect(en).toEqual(['asistente-escribir', 'asistente-respuesta'])
    const desde = todos.findIndex((p) => p.id === 'asistente')
    expect(todos.slice(desde + 1, desde + 3).map((p) => p.ruta)).toEqual([RUTA_ASISTENTE, RUTA_ASISTENTE])
    // Lo que sigue vuelve al Inicio.
    expect(todos.slice(desde + 3).every((p) => (p.ruta ?? '/') === '/')).toBe(true)
    expect(todos.find((p) => p.id === 'asistente')!.tipo).toBe('probar')
    expect(PREGUNTA_EJEMPLO).not.toMatch(/\d{1,2}-\d{2,4}-\d{3,6}|\d{6,}|@/)
    expect(PREGUNTA_EJEMPLO.length).toBeGreaterThan(10)
  })

  it('con el asistente apagado se omite su tramo y el paso del asistente solo informa, sin botón de probar', () => {
    const sin = pasosRecorrido({ ...base, asistente: false })
    expect(sin.map((p) => p.id)).toEqual(['bienvenida', 'buscar', 'asistente', 'menu', 'entrar', 'ayuda'])
    expect(sin.find((p) => p.id === 'asistente')!.tipo).toBeUndefined()
    expect(sin.some((p) => p.ruta === RUTA_ASISTENTE)).toBe(false)
  })

  it('no pasa de 10 pasos y cada texto es corto', () => {
    const todos = pasosRecorrido({ ...base, conSesion: true, gestion: true })
    expect(todos.length).toBeLessThanOrEqual(10)
    for (const p of todos) expect(p.texto.length).toBeLessThanOrEqual(200)
  })
})

describe('debeMostrarse (aparece solo la primera vez)', () => {
  it.each([
    [{ conSesion: false, vistoEnCuenta: false, vistoEnNavegador: false }, true],
    [{ conSesion: false, vistoEnCuenta: false, vistoEnNavegador: true }, false],
    [{ conSesion: true, vistoEnCuenta: false, vistoEnNavegador: false }, true],
    [{ conSesion: true, vistoEnCuenta: true, vistoEnNavegador: false }, false],
    [{ conSesion: true, vistoEnCuenta: false, vistoEnNavegador: true }, false],
  ])('%j → %s', (e, sale) => expect(debeMostrarse(e)).toBe(sale))
})
