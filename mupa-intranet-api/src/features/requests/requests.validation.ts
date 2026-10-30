/**
 * Revisión de las respuestas de una solicitud en el servidor: la MISMA lógica que
 * usa la web para avisar antes de enviar (mupa-intranet-app/src/lib/formularios.ts:
 * claves, seccionesVisibles, activos, errorDe, resumen), con los mismos mensajes.
 * Si se cambia una, hay que cambiar la otra; las pruebas de los dos lados usan los
 * mismos casos.
 *
 * Cada campo se identifica por su posición (una "ruta", p. ej. s0_nombre o
 * s2_servicios_c1_carpeta), no por su `k`.
 */
import { CEDULA } from '../../shared/cedula.ts'
import type { FormField, FormSection } from '../forms/dtos/form-definition.dto.ts'

/** Lo que manda la web: textos por ruta (v), casillas marcadas (c) e ítems de cada lista (i). */
export type Answers = { v: Record<string, string>; c: Record<string, number[]>; i: Record<string, number[]> }
export type Summary = { titulo: string; filas: { dt: string; dd: string }[] }[]
type Node = { ruta: string; campo: FormField; seccion: number; prefijo: string }

function slug(s: string): string {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Claves de campos hermanos: su `k` o la etiqueta en slug; si se repiten, -2, -3… */
function claves(campos: FormField[]): string[] {
  const vistas: Record<string, number> = {}
  return campos.map((c) => {
    const base = (c.k || slug(c.l)).replace(/[^a-z0-9-]/gi, '-').toLowerCase() || 'campo'
    vistas[base] = (vistas[base] || 0) + 1
    return vistas[base] === 1 ? base : base + '-' + vistas[base]
  })
}

const rutaSeccion = (i: number) => 's' + i

function valorDeRadio(sections: FormSection[], a: Answers, k: string): string {
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i]
    const cl = claves(s.fields)
    const n = s.fields.findIndex((c) => c.t === 'radio' && c.k === k)
    if (n >= 0) return a.v[rutaSeccion(i) + '_' + cl[n]] || ''
  }
  return ''
}

function seccionesVisibles(sections: FormSection[], a: Answers): { i: number; s: FormSection }[] {
  return sections.flatMap((s, i) => (!s.show || valorDeRadio(sections, a, s.show.k) === s.show.v ? [{ i, s }] : []))
}

function activos(sections: FormSection[], a: Answers): Node[] {
  const L: Node[] = []
  const recorrer = (campos: FormField[], base: string, seccion: number, prefijo: string) => {
    claves(campos).forEach((clave, n) => {
      const c = campos[n]
      const ruta = base + '_' + clave
      L.push({ ruta, campo: c, seccion, prefijo })
      if (c.t === 'checks') (c.items || []).forEach((it, j) => it.sub && (a.c[ruta] || []).includes(j) && recorrer(it.sub, ruta + '_c' + j, seccion, prefijo))
      if (c.t === 'repeat') (a.i[ruta] || []).forEach((id, k) => recorrer(c.fields || [], ruta + '_i' + id, seccion, prefijo + (c.item || 'Elemento') + ' ' + (k + 1) + ' · '))
    })
  }
  for (const { i, s } of seccionesVisibles(sections, a)) recorrer(s.fields, rutaSeccion(i), i, '')
  return L
}

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const TELEFONO = /^[0-9][0-9 -]{2,14}$/

function lleno(c: FormField, ruta: string, a: Answers): boolean {
  if (c.t === 'checks') return (a.c[ruta] || []).length > 0
  if (c.t === 'repeat') return (a.i[ruta] || []).length >= (c.min || 0)
  return (a.v[ruta] || '').trim() !== ''
}

function errorDe(c: FormField, ruta: string, a: Answers): string {
  if (c.r && !lleno(c, ruta, a)) {
    return c.t === 'radio' || c.t === 'select'
      ? 'Elige una opción en «' + c.l + '».'
      : c.t === 'checks'
        ? 'Marca al menos una opción en «' + c.l + '».'
        : 'Completa «' + c.l + '».'
  }
  const v = (a.v[ruta] || '').trim()
  // En el servidor además: una opción que no está en la lista, o una casilla que no existe, no vale.
  if ((c.t === 'radio' || c.t === 'select') && v && !(c.opts || []).includes(v)) return 'Elige una de las opciones de «' + c.l + '».'
  if (c.t === 'checks' && (a.c[ruta] || []).some((j) => !c.items?.[j])) return 'Marca solo opciones de «' + c.l + '».'
  if (c.t === 'repeat' && (a.i[ruta] || []).length > (c.max || 5)) return '«' + c.l + '» tiene demasiados elementos.'
  if (c.t === 'radio' || c.t === 'checks' || c.t === 'repeat' || c.t === 'select') return ''
  if (!v) return ''
  if (c.t === 'cedula' && !CEDULA.test(v)) return 'Escribe la cédula con guiones, p. ej. 8-123-4567.'
  if (c.t === 'email' && !CORREO.test(v)) return 'Escribe un correo válido, p. ej. nombre@dominio.gob.pa.'
  if (c.t === 'tel' && !TELEFONO.test(v)) return 'Usa solo números en «' + c.l + '».'
  if (c.t === 'number') {
    const n = Number(v)
    const min = c.min || 0
    if (!/^\d+$/.test(v) || n < min || (c.max !== undefined && n > c.max)) return '«' + c.l + '» debe ser un número entero entre ' + min + ' y ' + (c.max ?? '…') + '.'
  }
  return ''
}

function resumen(sections: FormSection[], a: Answers, nodos: Node[]): Summary {
  return seccionesVisibles(sections, a).flatMap(({ i, s }) => {
    const filas = nodos
      .filter((x) => x.seccion === i && x.campo.t !== 'repeat')
      .flatMap(({ ruta, campo: c, prefijo }) => {
        const dd = c.t === 'checks' ? (a.c[ruta] || []).map((j) => c.items?.[j]?.l).filter(Boolean).join(', ') : (a.v[ruta] || '').trim()
        return dd ? [{ dt: prefijo + c.l, dd }] : []
      })
    return filas.length ? [{ titulo: s.title, filas }] : []
  })
}

/**
 * Revisa las respuestas con la definición del formulario. Los datos del perfil
 * (nombre y correo) se toman de la sesión, no de lo que manda el navegador.
 * Devuelve los errores, o las respuestas limpias (solo lo que está en juego) y el resumen.
 */
export function reviewAnswers(
  sections: FormSection[],
  input: Answers,
  profile: { nombreCompleto?: string; correo?: string },
): { errors: { ruta: string; msg: string }[] } | { errors: []; data: Answers; summary: Summary } {
  const a: Answers = { v: { ...input.v }, c: { ...input.c }, i: { ...input.i } }
  let nodos = activos(sections, a)
  for (const { ruta, campo } of nodos) {
    const valor = campo.auto === 'nombreCompleto' || campo.auto === 'correo' ? profile[campo.auto]?.trim() : undefined
    if (valor) a.v[ruta] = valor
  }
  nodos = activos(sections, a)
  const errors = nodos.flatMap(({ ruta, campo }) => {
    const msg = errorDe(campo, ruta, a)
    return msg ? [{ ruta, msg }] : []
  })
  if (errors.length) return { errors }
  const data: Answers = { v: {}, c: {}, i: {} }
  for (const { ruta, campo } of nodos) {
    if (campo.t === 'checks') data.c[ruta] = a.c[ruta] || []
    else if (campo.t === 'repeat') data.i[ruta] = a.i[ruta] || []
    else if ((a.v[ruta] || '').trim()) data.v[ruta] = a.v[ruta].trim()
  }
  return { errors: [], data, summary: resumen(sections, a, nodos) }
}
