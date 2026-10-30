import { describe, expect, it } from 'vitest'

import { haceCuanto } from '../../src/lib/directorio'

describe('haceCuanto', () => {
  const ahora = new Date('2026-10-27T15:00:00Z')
  it('dice cuánto pasó en minutos, horas o días', () => {
    expect(haceCuanto('2026-10-27T14:59:30Z', ahora)).toBe('hace menos de un minuto')
    expect(haceCuanto('2026-10-27T14:59:00Z', ahora)).toBe('hace 1 minuto')
    expect(haceCuanto('2026-10-27T14:15:00Z', ahora)).toBe('hace 45 minutos')
    expect(haceCuanto('2026-10-27T13:00:00Z', ahora)).toBe('hace 2 horas')
    expect(haceCuanto('2026-10-24T15:00:00Z', ahora)).toBe('hace 3 días')
  })
  it('una fecha en el futuro (reloj adelantado) no da un tiempo negativo', () => {
    expect(haceCuanto('2026-10-27T15:05:00Z', ahora)).toBe('hace menos de un minuto')
  })
})
