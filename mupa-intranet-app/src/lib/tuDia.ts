/**
 * «Tu día» y «Mi resumen» del Inicio: lógica pura (sin red ni React) para que se pueda probar.
 * Cada consulta de la persona (citas de la Clínica, códigos de llamada, tickets de la Mesa de Ayuda, solicitudes
 * internas) llega como una `Fuente`: todavía cargando, no conectada (o sin cédula conocida), fallida o con datos.
 * Así nunca se dice «Nada pendiente» sin saberlo.
 */
import { citaAbierta, tituloCita, type CitaClinica } from './clinica'
import { codigoAbierto, tituloCodigo, type SolicitudCodigo } from './codigosLlamada'
import { diaLargo, fechaCorta, mayuscula } from './fechas'
import { estadoTicket, ticketAbierto, type TicketGlpi } from './glpi'
import { abierta, estadoDe, type SolicitudMia } from './solicitudes'

export type Fuente<T> = { estado: 'cargando' } | { estado: 'no' } | { estado: 'error' } | { estado: 'ok'; datos: T }

export const CARGANDO: Fuente<never> = { estado: 'cargando' }

/** Lo que respondió una consulta con «disponible» y «cédula conocida»: sin una de las dos, esa fuente no está conectada. */
export function comoFuente<T>(r: { disponible: boolean; cedulaConocida: boolean }, datos: T): Fuente<T> {
  return r.disponible && r.cedulaConocida ? { estado: 'ok', datos } : { estado: 'no' }
}

/** Una solicitud abierta, lista para mostrarse (y enlazar). */
export type Abierta = { clave: string; titulo: string; meta: string; h: string; nueva: boolean }

export type EstadoAbiertas = {
  /** Cuántas hay abiertas entre las fuentes que respondieron. */
  total: number
  /** Las primeras, para la lista corta. */
  items: Abierta[]
  /** Alguna fuente conectada falló: la cifra puede estar incompleta. */
  incompleto: boolean
  /** Alguna fuente sigue cargando. */
  cargando: boolean
  /** Hay al menos una fuente conectada (si no, la tarjeta no se muestra). */
  conectada: boolean
}

type EntradaAbiertas = { solicitudes: Fuente<SolicitudMia[]>; tickets: Fuente<TicketGlpi[]>; codigos: Fuente<SolicitudCodigo[]> }

/** Cuenta y lista lo abierto: solicitudes internas, tickets de la Mesa de Ayuda y códigos de llamada (las citas van en «Próxima cita»). */
export function abiertasDeLaPersona(e: EntradaAbiertas, max = 3): EstadoAbiertas {
  const fuentes = [e.solicitudes, e.tickets, e.codigos]
  const items: Abierta[] = []
  if (e.solicitudes.estado === 'ok')
    for (const s of e.solicitudes.datos.filter((x) => abierta(x.estado)))
      items.push({ clave: 's' + s.id, titulo: s.formulario, meta: s.folio + ' · ' + estadoDe(s.estado).t, h: '/mis-solicitudes/' + s.id, nueva: !!s.sinLeer })
  if (e.codigos.estado === 'ok')
    for (const c of e.codigos.datos.filter(codigoAbierto)) items.push({ clave: 'c' + c.numero, titulo: tituloCodigo(c), meta: 'Código de llamada · N.º ' + c.numero + ' · ' + c.estado, h: '/mis-solicitudes', nueva: false })
  if (e.tickets.estado === 'ok')
    for (const t of e.tickets.datos.filter(ticketAbierto)) items.push({ clave: 't' + t.numero, titulo: t.titulo, meta: 'Mesa de Ayuda · Ticket N.º ' + t.numero + ' · ' + estadoTicket(t.estadoId), h: '/mis-solicitudes', nueva: false })
  return {
    total: items.length,
    items: items.slice(0, max),
    incompleto: fuentes.some((f) => f.estado === 'error'),
    cargando: fuentes.some((f) => f.estado === 'cargando'),
    conectada: fuentes.some((f) => f.estado !== 'no'),
  }
}

/** La línea de un vacío o de una cifra incompleta (null: hay una lista que mostrar y nada que aclarar). */
export function textoAbiertas(a: EstadoAbiertas): string | null {
  if (a.cargando && !a.total) return null
  if (!a.total) return a.incompleto ? 'No se pudo consultar ahora. Míralas en Mis solicitudes.' : 'Nada pendiente.'
  return a.incompleto ? 'Falta un sistema por consultar ahora; la lista puede estar incompleta.' : null
}

/** La cita abierta más próxima (por fecha y hora), o null. Las pasadas, atendidas o canceladas no cuentan. */
export function proximaCita(citas: CitaClinica[], hoy: string): CitaClinica | null {
  return [...citas].filter((c) => citaAbierta(c, hoy)).sort((a, b) => (a.fecha + (a.hora ?? '')).localeCompare(b.fecha + (b.hora ?? '')))[0] ?? null
}

/** «Jueves 22 de octubre de 2026». */
export const fechaDeHoy = (hoy: string): string => mayuscula(diaLargo(hoy))

/** El texto de la cita: «Cita de medicina general». */
export const nombreCita = (c: CitaClinica): string => tituloCita(c)

/** La fecha de un comprobante para la tarjeta («15 oct 2026»), o «—» si no la trae. */
export const fechaComprobante = (fecha: string | null): string => (fecha ? fechaCorta(fecha.slice(0, 10)) : '—')

/** Cifras de «Mi resumen» con RRHH Express conectado. Cada una puede faltar (null) sin tumbar las demás. */
export type ResumenRrhh = {
  conectada: boolean
  /** Minutos de tiempo compensatorio disponible. */
  compensatorioMin: number | null
  /** Lo que vence pronto (minutos y días), si hay algo en los próximos 30 días. */
  vence: { minutos: number; dias: number } | null
  /** Marcaciones del mes en curso. */
  marcaciones: { mes: string; presentes: number; tardanzas: number; ausencias: number } | null
  /** Último comprobante de pago: su fecha y su período ya formateados. `sin`: no hay comprobantes (distinto de no haberlo podido consultar). */
  comprobante: { fecha: string; periodo: string } | 'sin' | null
}

/** El vencimiento más cercano (hoy o en los próximos 30 días) con minutos por vencer. */
export function vencimientoPronto(v: { minutos: number; diasRestantes: number | null }[]): { minutos: number; dias: number } | null {
  const l = v.filter((x) => x.diasRestantes !== null && x.diasRestantes >= 0 && x.diasRestantes <= 30 && x.minutos > 0).sort((a, b) => a.diasRestantes! - b.diasRestantes!)[0]
  return l ? { minutos: l.minutos, dias: l.diasRestantes! } : null
}

/** La nota de una cifra del mes: «Sin tardanzas» si es cero; si no, de qué período es (la cifra ya está arriba). */
export const notaConteo = (n: number, sin: string): string => (n === 0 ? sin : 'En lo que va del mes')
