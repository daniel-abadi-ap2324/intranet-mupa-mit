/**
 * Tickets de la Mesa de Ayuda (GLPI) de la persona (GET /api/glpi/tickets): el texto y el tono de cada estado y las
 * fechas. Lógica pura. GLPI encuentra a la persona por su cédula en el campo «Teléfono» de su usuario.
 */

export type TicketGlpi = {
  numero: number
  titulo: string
  /** 1 nuevo, 2 en curso (asignado), 3 en curso (planificado), 4 en espera, 5 resuelto, 6 cerrado; 0 desconocido. */
  estadoId: number
  /** "AAAA-MM-DD HH:MM:SS". */
  abierto: string
  actualizado: string
}

/**
 * `disponible` false = este servidor no tiene conectado GLPI; `cedulaConocida` false = la sesión no tiene cédula;
 * `usuarioEncontrado` false = ninguna cuenta de GLPI tiene esa cédula en «Teléfono» (por eso no salen sus tickets).
 */
export type MisTickets = { disponible: boolean; cedulaConocida: boolean; usuarioEncontrado: boolean; total: number; tickets: TicketGlpi[] }

const ESTADOS: Record<number, string> = {
  1: 'Nuevo',
  2: 'En curso (asignado)',
  3: 'En curso (planificado)',
  4: 'En espera',
  5: 'Resuelto',
  6: 'Cerrado',
}

export const estadoTicket = (estadoId: number): string => ESTADOS[estadoId] ?? 'Sin estado'

/** Nuevo, en curso y en espera siguen abiertos; resuelto y cerrado, no. */
export const ticketAbierto = (t: TicketGlpi): boolean => t.estadoId >= 1 && t.estadoId <= 4

/** Clases de estado (.st--…): resuelto y cerrado ok; los demás (también «en espera», que espera a la persona, no es un rechazo) asg. */
export function claseEstadoTicket(estadoId: number): string {
  if (estadoId === 5 || estadoId === 6) return 'ok'
  return 'asg'
}

/** "2026-10-05 14:20:00" → "2026-10-05". */
export const diaTicket = (fecha: string): string => fecha.slice(0, 10)

/** "2026-10-05 14:20:00" → "14:20"; sin hora → null. */
export function horaTicket(fecha: string): string | null {
  const m = fecha.match(/[ T](\d{2}:\d{2})/)
  return m ? m[1] : null
}
