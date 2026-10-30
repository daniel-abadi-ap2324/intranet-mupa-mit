import { describe, expect, it } from 'vitest'

import { textoAnticipacion, textoDiasAtencion } from '@/lib/clinica'

describe('textoDiasAtencion (días que publica el sistema de citas)', () => {
  it.each([
    [[0, 6], 'de lunes a viernes'],
    [[0], 'de lunes a sábado'],
    [[], 'todos los días'],
    [[0, 2, 4, 6], 'lunes, miércoles y viernes'],
    [[0, 3, 4, 5, 6], 'lunes y martes'],
    [[0, 1, 2, 3, 4, 5, 6], 'sin días de atención publicados'],
  ])('cerrados %j → %s', (cerrados, texto) => expect(textoDiasAtencion(cerrados)).toBe(texto))
})

describe('textoAnticipacion', () => {
  it('desde mañana, desde hoy o con varios días', () => {
    expect(textoAnticipacion({ minDias: 1, maxDias: 90 })).toBe('desde mañana y hasta con 90 días de anticipación')
    expect(textoAnticipacion({ minDias: 0, maxDias: 30 })).toBe('desde hoy y hasta con 30 días de anticipación')
    expect(textoAnticipacion({ minDias: 2, maxDias: 60 })).toBe('con al menos 2 días de anticipación y hasta con 60 días de anticipación')
  })
})
