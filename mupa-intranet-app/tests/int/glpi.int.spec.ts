/** Tickets de la Mesa de Ayuda (GLPI): abiertos o cerrados por su estado, texto y clase de cada estado y fechas. */
import { describe, expect, it } from 'vitest'

import { claseEstadoTicket, diaTicket, estadoTicket, horaTicket, ticketAbierto, type TicketGlpi } from '@/lib/glpi'

const ticket = (estadoId: number): TicketGlpi => ({ numero: 1, titulo: 'Soporte – Dirección Ficticia (1)', estadoId, abierto: '2026-10-01 09:30:00', actualizado: '2026-10-02 11:05:00' })

describe('estados', () => {
  it('abiertos: nuevo, en curso y en espera (1 a 4); cerrados: resuelto y cerrado', () => {
    expect([1, 2, 3, 4].map((id) => ticketAbierto(ticket(id)))).toEqual([true, true, true, true])
    expect([5, 6, 0].map((id) => ticketAbierto(ticket(id)))).toEqual([false, false, false])
  })

  it('cada estado tiene su texto y su clase; uno desconocido no se inventa', () => {
    expect([1, 2, 3, 4, 5, 6].map(estadoTicket)).toEqual(['Nuevo', 'En curso (asignado)', 'En curso (planificado)', 'En espera', 'Resuelto', 'Cerrado'])
    expect(estadoTicket(0)).toBe('Sin estado')
    expect([1, 2, 3, 4, 5, 6].map(claseEstadoTicket)).toEqual(['asg', 'asg', 'asg', 'asg', 'ok', 'ok'])
  })
})

describe('fechas', () => {
  it('separa el día y la hora de la fecha de GLPI', () => {
    expect(diaTicket('2026-10-02 11:05:00')).toBe('2026-10-02')
    expect(horaTicket('2026-10-02 11:05:00')).toBe('11:05')
    expect(horaTicket('2026-10-02')).toBeNull()
  })
})
