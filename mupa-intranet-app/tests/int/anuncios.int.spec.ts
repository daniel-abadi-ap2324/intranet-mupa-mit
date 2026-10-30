import { describe, expect, it } from 'vitest'

import { revisarAnuncio, textoFechas, type DatosAnuncio } from '@/lib/anuncios'

const base: DatosAnuncio = { titulo: 'Mantenimiento del correo', detalle: null, nivel: 'normal', enlace: null, desde: '2026-09-28', hasta: null, publicacion: 'publicado' }

describe('textoFechas', () => {
  it('sin fecha final, un solo día y un rango', () => {
    expect(textoFechas('2026-09-03', null)).toBe('Desde el 3 sep 2026, sin fecha final')
    expect(textoFechas('2026-09-03', '2026-09-03')).toBe('Solo el 3 sep 2026')
    expect(textoFechas('2026-09-03', '2026-10-01')).toBe('Del 3 sep 2026 al 1 oct 2026')
  })
})

describe('revisarAnuncio (lo mismo que revisa el backend)', () => {
  it('un anuncio completo no tiene errores', () => {
    expect(revisarAnuncio({ ...base, detalle: 'Sábado de 8 a 10 p.m.', enlace: '/mesa-servicios', hasta: '2026-09-28' })).toEqual({})
  })

  it('título vacío o demasiado largo', () => {
    expect(revisarAnuncio({ ...base, titulo: '   ' }).titulo).toMatch(/título/)
    expect(revisarAnuncio({ ...base, titulo: 'x'.repeat(121) }).titulo).toMatch(/120/)
  })

  it('enlaces con IP, nombres internos, otros protocolos, http o "/\\"', () => {
    for (const enlace of ['http://192.0.2.10/app', 'http://servidor/app', 'javascript:alert(1)', 'http://sistema.ejemplo.gob.pa', '/\\ejemplo.com']) expect(revisarAnuncio({ ...base, enlace }).enlace, enlace).toBeTruthy()
    expect(revisarAnuncio({ ...base, enlace: 'https://sistema.ejemplo.gob.pa' })).toEqual({})
  })

  it('la fecha final no puede ser anterior a la de inicio', () => {
    expect(revisarAnuncio({ ...base, hasta: '2026-09-27' }).hasta).toMatch(/anterior/)
    expect(revisarAnuncio({ ...base, desde: '' }).desde).toBeTruthy()
  })
})
