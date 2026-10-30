/**
 * Información de la Clínica que llega del sistema de citas (GET /api/clinic):
 * tipos y textos. Lógica pura.
 */

export type InfoClinica = {
  servicios: { id: number; nombre: string; descripcion: string | null }[]
  especialidades: { id: number; nombre: string; descripcion: string | null }[]
  /** Días de la semana sin atención (0 = domingo … 6 = sábado). */
  diasCerrados: number[]
  anticipacion: { minDias: number; maxDias: number }
  /** 'clinica': leído del sistema de citas; 'respaldo': copia guardada (no respondió). */
  fuente: 'clinica' | 'respaldo'
  /** Cuándo se leyó (ISO). */
  actualizado: string
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

/** [0, 6] → "de lunes a viernes"; días sueltos → "lunes, miércoles y viernes". */
export function textoDiasAtencion(cerrados: number[]): string {
  const abiertos = [1, 2, 3, 4, 5, 6, 0].filter((d) => !cerrados.includes(d))
  if (!abiertos.length) return 'sin días de atención publicados'
  if (abiertos.length === 7) return 'todos los días'
  // Una sola racha seguida (lunes → sábado, con domingo al final) se dice "de … a …".
  const orden = [1, 2, 3, 4, 5, 6, 0]
  const pos = abiertos.map((d) => orden.indexOf(d))
  const seguidos = pos.every((p, i) => i === 0 || p === pos[i - 1] + 1)
  if (seguidos && abiertos.length > 2) return 'de ' + DIAS[abiertos[0]] + ' a ' + DIAS[abiertos[abiertos.length - 1]]
  const nombres = abiertos.map((d) => DIAS[d])
  return nombres.length === 1 ? nombres[0] : nombres.slice(0, -1).join(', ') + ' y ' + nombres[nombres.length - 1]
}

/** { 1, 90 } → "desde mañana y hasta con 90 días de anticipación". */
export function textoAnticipacion({ minDias, maxDias }: { minDias: number; maxDias: number }): string {
  const desde = minDias <= 0 ? 'desde hoy' : minDias === 1 ? 'desde mañana' : `con al menos ${minDias} días de anticipación`
  return `${desde} y hasta con ${maxDias} días de anticipación`
}

/** Una cita de la persona en la Clínica (GET /api/clinic/appointments). */
export type CitaClinica = {
  id: string
  /** YYYY-MM-DD */
  fecha: string
  /** HH:MM (24 h) o null */
  hora: string | null
  tipo: string | null
  especialidad: string | null
  medico: string | null
  estado: string
  atendida: boolean
  cancelada: boolean
}

/** Las citas de la persona. `disponible` false = este servidor no tiene conectada la Clínica; `cedulaConocida` false = la sesión no tiene cédula. */
export type MisCitas = { disponible: boolean; cedulaConocida: boolean; esPaciente: boolean; total: number; citas: CitaClinica[] }

type Tono = 'ok' | 'info' | 'warn' | 'off'

/** Los estados del sistema de la Clínica, con un texto para la persona y su tono (color). */
const ESTADOS: Record<string, { texto: string; tono: Tono }> = {
  AGENDADA: { texto: 'Agendada', tono: 'info' },
  EN_ESPERA: { texto: 'En espera del médico', tono: 'info' },
  ATENDIDA: { texto: 'Atendida', tono: 'ok' },
  ASISTIO: { texto: 'Asististe', tono: 'ok' },
  NO_ASISTIO: { texto: 'No asististe', tono: 'warn' },
  VENCIDA: { texto: 'Pasó la fecha sin registro', tono: 'warn' },
  CANCELADA: { texto: 'Cancelada', tono: 'off' },
}

export function estadoCita(estado: string): { texto: string; tono: Tono } {
  return ESTADOS[estado] ?? { texto: estado.charAt(0) + estado.slice(1).toLowerCase().replace(/_/g, ' '), tono: 'off' }
}

/** "09:30" → "9:30 a. m."; "14:05" → "2:05 p. m."; sin hora → null. */
export function horaCita(hora: string | null): string | null {
  const m = hora?.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  const h = Number(m[1])
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'a. m.' : 'p. m.'}`
}

/** Próximas = agendadas o en espera cuya fecha no pasó (la más cercana primero); el resto, historial (la más reciente primero). */
export function separarCitas(citas: CitaClinica[], hoy: string): { proximas: CitaClinica[]; historial: CitaClinica[] } {
  const activa = (c: CitaClinica) => (c.estado === 'AGENDADA' || c.estado === 'EN_ESPERA') && c.fecha >= hoy
  const orden = (a: CitaClinica, b: CitaClinica) => (a.fecha + (a.hora ?? '')).localeCompare(b.fecha + (b.hora ?? ''))
  return { proximas: citas.filter(activa).sort(orden), historial: citas.filter((c) => !activa(c)).sort((a, b) => orden(b, a)) }
}

/** ¿La cita sigue abierta (agendada o en espera, y su fecha no pasó)? Es lo que «Abiertas» cuenta en Mis solicitudes. */
export function citaAbierta(c: CitaClinica, hoy: string): boolean {
  return (c.estado === 'AGENDADA' || c.estado === 'EN_ESPERA') && c.fecha >= hoy
}

/** Clases de estado del Inicio (.st--…) según el tono de la cita. */
const CLASE_TONO: Record<Tono, string> = { ok: 'ok', info: 'asg', warn: 'rev', off: 'off' }
export const claseEstadoCita = (estado: string) => CLASE_TONO[estadoCita(estado).tono]

/**
 * "Cita · Odontología", "Urgencia · Medicina general" o "Cita médica" si no hay especialidad: el título de la cita en
 * Mis solicitudes. El `tipo` del sistema de la Clínica es una categoría (CITAS, CUPOS, URGENCIA…), no un nombre para mostrar:
 * solo se distingue la urgencia.
 */
export function tituloCita(c: CitaClinica): string {
  const base = c.tipo?.toUpperCase() === 'URGENCIA' ? 'Urgencia' : 'Cita'
  return c.especialidad ? base + ' · ' + c.especialidad : base === 'Urgencia' ? base : 'Cita médica'
}
