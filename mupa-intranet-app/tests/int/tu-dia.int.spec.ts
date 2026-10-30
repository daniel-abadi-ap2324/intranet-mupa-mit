/** «Tu día» y «Mi resumen»: cuenta de abiertas, textos de vacío, próxima cita, fecha y vencimientos. */
import { describe, expect, it } from 'vitest'

import type { CitaClinica } from '@/lib/clinica'
import type { TicketGlpi } from '@/lib/glpi'
import { abiertasDeLaPersona, comoFuente, fechaComprobante, fechaDeHoy, notaConteo, proximaCita, textoAbiertas, vencimientoPronto, type Fuente } from '@/lib/tuDia'

const ticket = (numero: number, estadoId: number): TicketGlpi => ({ numero, titulo: 'Ticket ' + numero, estadoId, abierto: '2026-10-01 09:30:00', actualizado: '2026-10-02 11:05:00' })
const cita = (id: string, fecha: string, hora: string | null, extra: Partial<CitaClinica> = {}): CitaClinica => ({ id, fecha, hora, tipo: null, especialidad: 'Medicina general', medico: null, estado: 'AGENDADA', atendida: false, cancelada: false, ...extra })
const NO: Fuente<never> = { estado: 'no' }
const ERR: Fuente<never> = { estado: 'error' }

describe('abiertasDeLaPersona', () => {
  it('cuenta solo lo abierto de las fuentes que respondieron', () => {
    const a = abiertasDeLaPersona({ solicitudes: NO, codigos: NO, tickets: { estado: 'ok', datos: [ticket(1, 2), ticket(2, 6), ticket(3, 1)] } })
    expect(a.total).toBe(2)
    expect(a.items.map((x) => x.clave)).toEqual(['t1', 't3'])
    expect(a.conectada).toBe(true)
    expect(textoAbiertas(a)).toBeNull()
  })
  it('sin nada abierto dice «Nada pendiente»', () => {
    const a = abiertasDeLaPersona({ solicitudes: NO, codigos: { estado: 'ok', datos: [] }, tickets: { estado: 'ok', datos: [ticket(2, 6)] } })
    expect(textoAbiertas(a)).toBe('Nada pendiente.')
  })
  it('si una consulta falló y no hay nada, no dice «Nada pendiente»', () => {
    const a = abiertasDeLaPersona({ solicitudes: NO, codigos: ERR, tickets: { estado: 'ok', datos: [] } })
    expect(textoAbiertas(a)).toMatch(/No se pudo consultar/)
  })
  it('si falló una y hay otras abiertas, avisa que puede estar incompleto', () => {
    const a = abiertasDeLaPersona({ solicitudes: NO, codigos: ERR, tickets: { estado: 'ok', datos: [ticket(1, 2)] } })
    expect(textoAbiertas(a)).toMatch(/incompleta/)
  })
  it('sin ninguna fuente conectada no hay tarjeta; mientras carga no hay texto', () => {
    expect(abiertasDeLaPersona({ solicitudes: NO, codigos: NO, tickets: NO }).conectada).toBe(false)
    const c = abiertasDeLaPersona({ solicitudes: NO, codigos: { estado: 'cargando' }, tickets: NO })
    expect(c.cargando).toBe(true)
    expect(textoAbiertas(c)).toBeNull()
  })
  it('la lista corta se limita a 3', () => {
    const a = abiertasDeLaPersona({ solicitudes: NO, codigos: NO, tickets: { estado: 'ok', datos: [1, 2, 3, 4, 5].map((n) => ticket(n, 2)) } })
    expect([a.total, a.items.length]).toEqual([5, 3])
  })
})

describe('comoFuente', () => {
  it('sin conexión o sin cédula conocida no está conectada', () => {
    expect(comoFuente({ disponible: false, cedulaConocida: true }, []).estado).toBe('no')
    expect(comoFuente({ disponible: true, cedulaConocida: false }, []).estado).toBe('no')
    expect(comoFuente({ disponible: true, cedulaConocida: true }, [1]).estado).toBe('ok')
  })
})

describe('proximaCita', () => {
  it('toma la abierta más cercana por fecha y hora, sin pasadas ni canceladas', () => {
    const citas = [cita('1', '2026-10-30', '14:00'), cita('2', '2026-10-25', '15:00'), cita('3', '2026-10-25', '09:00'), cita('4', '2026-10-23', '08:00', { cancelada: true, estado: 'CANCELADA' }), cita('5', '2026-10-01', '08:00')]
    expect(proximaCita(citas, '2026-10-22')?.id).toBe('3')
    expect(proximaCita([], '2026-10-22')).toBeNull()
  })
})

describe('formatos', () => {
  it('fecha larga de hoy', () => expect(fechaDeHoy('2026-10-22')).toBe('Jueves 22 de octubre de 2026'))
  it('fecha del comprobante, o «—»', () => {
    expect(fechaComprobante('2026-10-15')).toBe('15 oct 2026')
    expect(fechaComprobante(null)).toBe('—')
  })
  it('notas del mes', () => {
    expect(notaConteo(0, 'Sin tardanzas')).toBe('Sin tardanzas')
    expect(notaConteo(2, 'Sin tardanzas')).toBe('En lo que va del mes')
  })
  it('vencimiento pronto: el más cercano en 30 días, con minutos', () => {
    expect(vencimientoPronto([{ minutos: 60, diasRestantes: 20 }, { minutos: 30, diasRestantes: 5 }, { minutos: 90, diasRestantes: 100 }, { minutos: 0, diasRestantes: 1 }])).toEqual({ minutos: 30, dias: 5 })
    expect(vencimientoPronto([{ minutos: 60, diasRestantes: null }])).toBeNull()
  })
})
