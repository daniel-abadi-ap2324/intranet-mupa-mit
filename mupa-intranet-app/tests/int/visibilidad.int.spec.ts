import { describe, expect, it } from 'vitest'

import { agrupar, cuantasVen, grupoDe, laVe, normalizar, poner, ponerGrupo } from '../../src/lib/visibilidad'

const todas = [1, 2, 3, 4]

describe('visibilidad de las aplicaciones', () => {
  it('agrupa por el comienzo del nombre', () => {
    expect(grupoDe('Dirección de Finanzas')).toBe('direcciones')
    expect(grupoDe('Sub-Dirección de Seguridad Electrónica')).toBe('direcciones')
    expect(grupoDe('Junta Comunal de Bella Vista')).toBe('juntas')
    expect(grupoDe('Departamento de Mejoras Continuas')).toBe('departamentos')
    for (const n of ['Oficina de Cooperación Internacional', 'Despacho del Alcalde', 'Secretaría General', 'Concejo Municipal', 'Tesorería Municipal']) expect(grupoDe(n)).toBe('oficinas')
    expect(grupoDe('Control de Ordenamiento Urbano')).toBe('otras')
    expect(agrupar([{ id: 1, name: 'Despacho del Alcalde' }, { id: 2, name: 'Dirección X' }]).map((g) => g.id)).toEqual(['direcciones', 'oficinas'])
  })

  it('sin departamentos la ven todas', () => {
    expect(laVe([], 3)).toBe(true)
    expect(laVe([1], 3)).toBe(false)
    expect(cuantasVen([], 62)).toBe(62)
    expect(cuantasVen([1, 2], 62)).toBe(2)
  })

  it('apagar una para todas la deja en «todas menos esta»', () => {
    expect(poner([], 2, false, todas)).toMatchObject({ ids: [1, 3, 4] })
  })

  it('prender hasta cubrir a todas vuelve a «todas»', () => {
    expect(poner([1, 3, 4], 2, true, todas)).toEqual({ ids: [] })
    expect(poner([1], 2, true, todas)).toEqual({ ids: [1, 2] })
    expect(normalizar([1, 2, 3, 4, 99], todas)).toEqual([])
  })

  it('no deja quitar a la única que la ve', () => {
    expect(poner([2], 2, false, todas)).toHaveProperty('bloqueado')
    expect(poner([1, 2], 2, false, todas)).toEqual({ ids: [1] })
  })

  it('marca y desmarca un grupo', () => {
    expect(ponerGrupo([1], [2, 3], true).sort()).toEqual([1, 2, 3])
    expect(ponerGrupo([1, 2, 3], [2, 3], false)).toEqual([1])
  })
})
