/** Solicitudes enviadas con los formularios que reciben solicitudes (/api/requests). */

export type EstadoSolicitud = 'recibida' | 'en_revision' | 'resuelta' | 'rechazada'

/** Nombre y color de cada estado (clases .st--… del bloque del Inicio y tonos de .tagline). */
export const ESTADOS_SOLICITUD: { v: EstadoSolicitud; t: string; st: string; tono: 'brand' | 'warn' | 'ok' | null }[] = [
  { v: 'recibida', t: 'Recibida', st: 'asg', tono: 'brand' },
  { v: 'en_revision', t: 'En revisión', st: 'rev', tono: 'warn' },
  { v: 'resuelta', t: 'Resuelta', st: 'ok', tono: 'ok' },
  { v: 'rechazada', t: 'Rechazada', st: 'err', tono: null },
]
export const estadoDe = (v: string) => ESTADOS_SOLICITUD.find((e) => e.v === v) ?? { v, t: v, st: 'off', tono: null }
/** Abierta = todavía la están atendiendo. */
export const abierta = (v: string) => v === 'recibida' || v === 'en_revision'

type Base = { id: number; folio: string; formulario: string; area: string; estado: EstadoSolicitud; creada: string; actualizada: string }
export type SolicitudMia = Base & { sinLeer: boolean }
export type SolicitudGestion = Base & { persona: string; correo: string | null; departamento: string | null }
export type Evento = { id: number; tipo: 'creada' | 'estado' | 'mensaje'; estado: string | null; texto: string | null; autor: string | null; delGestor: boolean; fecha: string }
export type SolicitudDetalle = SolicitudGestion & { resumen: { titulo: string; filas: { dt: string; dd: string }[] }[]; eventos: Evento[] }
