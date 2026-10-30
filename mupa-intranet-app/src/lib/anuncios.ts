/**
 * Anuncios institucionales del Inicio (los publica Comunicación desde
 * /gestion/anuncios). Lógica pura: tipos, textos y la revisión del formulario.
 * Quien de verdad valida es el backend; esto solo avisa antes de enviar.
 */
import { fechaCorta } from './fechas'
import { revisarUrl } from './url'

export type Nivel = 'urgente' | 'importante' | 'normal'
/** Lo que decide Comunicación. */
export type Publicacion = 'borrador' | 'publicado' | 'retirado'
/** Lo que se ve en el panel: un "publicado" puede estar vigente, programado o vencido según sus fechas. */
export type EstadoAnuncio = 'vigente' | 'programado' | 'vencido' | 'borrador' | 'retirado'

export type Anuncio = {
  id: number
  titulo: string
  detalle: string | null
  nivel: Nivel
  enlace: string | null
  /** "AAAA-MM-DD" */
  desde: string
  /** "AAAA-MM-DD" o null (no vence). */
  hasta: string | null
}

export type AnuncioGestion = Anuncio & { publicacion: Publicacion; estado: EstadoAnuncio; editado: string; editadoPor: string | null }

/** Lo que se envía al crear o editar. */
export type DatosAnuncio = Omit<Anuncio, 'id'> & { publicacion: Publicacion }

export const MAX_TITULO = 120
export const MAX_DETALLE = 500

export const NIVELES: { v: Nivel; t: string; d: string }[] = [
  { v: 'urgente', t: 'Urgente', d: 'Afecta a todos hoy (evacuación, cortes, cierres).' },
  { v: 'importante', t: 'Importante', d: 'Plazos o cambios que hay que tener en cuenta.' },
  { v: 'normal', t: 'Informativo', d: 'Novedades y recordatorios.' },
]
export const NIVEL_TEXTO: Record<Nivel, string> = { urgente: 'Urgente', importante: 'Importante', normal: 'Informativo' }

export const ESTADOS: { v: EstadoAnuncio; t: string; tono: 'ok' | 'warn' | 'brand' | null }[] = [
  { v: 'vigente', t: 'Vigente', tono: 'ok' },
  { v: 'programado', t: 'Programado', tono: 'brand' },
  { v: 'borrador', t: 'Borrador', tono: 'warn' },
  { v: 'vencido', t: 'Vencido', tono: null },
  { v: 'retirado', t: 'Retirado', tono: null },
]

/** "Del 3 sep 2026 al 30 sep 2026", "Desde el 3 sep 2026, sin fecha final", "Solo el 3 sep 2026". */
export function textoFechas(desde: string, hasta: string | null): string {
  if (!hasta) return 'Desde el ' + fechaCorta(desde) + ', sin fecha final'
  if (hasta === desde) return 'Solo el ' + fechaCorta(desde)
  return 'Del ' + fechaCorta(desde) + ' al ' + fechaCorta(hasta)
}

export type ErroresAnuncio = Partial<Record<keyof DatosAnuncio, string>>

/** Lo mismo que revisa el backend, para avisar al lado de cada campo antes de enviar. */
export function revisarAnuncio(d: DatosAnuncio): ErroresAnuncio {
  const e: ErroresAnuncio = {}
  if (!d.titulo.trim()) e.titulo = 'Escribe el título del anuncio.'
  else if (d.titulo.trim().length > MAX_TITULO) e.titulo = `El título puede tener hasta ${MAX_TITULO} caracteres.`
  if ((d.detalle || '').trim().length > MAX_DETALLE) e.detalle = `El detalle puede tener hasta ${MAX_DETALLE} caracteres.`
  const url = revisarUrl(d.enlace, { soloHttps: true })
  if (url.error) e.enlace = url.error
  if (!d.desde) e.desde = 'Elige desde qué día se muestra.'
  if (d.desde && d.hasta && d.hasta < d.desde) e.hasta = 'La fecha final no puede ser anterior a la de inicio.'
  return e
}

/** Nombre del campo en el backend → campo del formulario (para poner cada error en su lugar). */
export const CAMPO_DEL_BACKEND: Record<string, keyof DatosAnuncio> = {
  title: 'titulo',
  body: 'detalle',
  level: 'nivel',
  link: 'enlace',
  publishFrom: 'desde',
  publishUntil: 'hasta',
  status: 'publicacion',
}
