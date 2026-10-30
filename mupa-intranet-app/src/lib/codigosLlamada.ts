/**
 * Solicitudes de código de llamada de la persona (GET /api/call-codes/requests): estados con su texto y su tono,
 * el historial en español y las fechas. Lógica pura. La lógica va por `estadoId` (el `estado` es el nombre para mostrar).
 */

export type PasoCodigo = { accion: string; fecha: string }

export type SolicitudCodigo = {
  numero: number
  estadoId: number
  /** Nombre del estado tal como lo manda el sistema de códigos de llamada. */
  estado: string
  /** AAAA-MM-DDTHH:MM:SS, hora de Panamá. */
  creada: string
  actualizada: string
  ubicacion: string | null
  linea: string | null
  extension: string | null
  motivoRechazo: string | null
  historial: PasoCodigo[]
}

/** Las solicitudes de la persona. `disponible` false = este servidor no tiene conectado el sistema; `cedulaConocida` false = la sesión no tiene cédula. */
export type MisCodigos = { disponible: boolean; cedulaConocida: boolean; total: number; solicitudes: SolicitudCodigo[] }

/** 1 a 3 esperan una aprobación, 4 espera que se genere el código; 5 rechazada, 6 procesada y 7 anulada son finales. */
export const codigoAbierto = (s: SolicitudCodigo): boolean => s.estadoId >= 1 && s.estadoId <= 4

/** Clases de estado del Inicio (.st--…): procesada ok, rechazada rev, anulada off y las que siguen su curso asg. */
export function claseEstadoCodigo(estadoId: number): string {
  if (estadoId === 6) return 'ok'
  if (estadoId === 5) return 'rev'
  if (estadoId === 7) return 'off'
  return 'asg'
}

const ACCIONES: Record<string, string> = {
  CREATE: 'Solicitud creada',
  APPROVE: 'Aprobada',
  REJECT: 'Rechazada',
  PROCESS: 'Procesada: se generó el código',
  UPDATE: 'Datos modificados',
  STATUS_CHANGE: 'Cambió de estado',
  ANULAR: 'Anulada',
}

export function textoAccion(accion: string): string {
  return ACCIONES[accion] ?? accion.charAt(0).toUpperCase() + accion.slice(1).toLowerCase().replace(/_/g, ' ')
}

/** "2026-09-15T10:32:00" → "2026-09-15". */
export const diaDe = (fecha: string): string => fecha.slice(0, 10)

/** "2026-09-15T14:05:00" → "14:05"; sin hora → null (la hora se escribe con `horaCita` de lib/clinica). */
export function horaDe(fecha: string): string | null {
  const m = fecha.match(/T(\d{2}:\d{2})/)
  return m ? m[1] : null
}

/** "Línea LOCALES · ext. 4521"; con partes que falten, las que haya; sin nada, "Código de llamada". */
export function tituloCodigo(s: SolicitudCodigo): string {
  const partes = [s.linea ? 'Línea ' + s.linea : null, s.extension ? 'ext. ' + s.extension : null].filter(Boolean)
  return partes.length ? partes.join(' · ') : 'Código de llamada'
}
