/**
 * Formularios de solicitud: lógica pura (sin React), probada en
 * tests/int/formularios.int.spec.ts. Los formularios los arma el Gestor de
 * Solicitudes y vienen de la API (/api/forms); un solo componente los pinta.
 * Si el formulario no recibe solicitudes (`recibe`), el envío es de prueba.
 *
 * Cada campo se identifica por su posición (una "ruta"), no por su `k`: el mismo
 * `k` se repite entre secciones (quién solicita / para quién es) y varios campos
 * no lo tienen. La ruta sirve también de id en la página.
 */
import { slug } from './catalogo'

export type Tipo = 'text' | 'email' | 'tel' | 'cedula' | 'number' | 'textarea' | 'select' | 'radio' | 'checks' | 'repeat'
export type Campo = {
  k?: string
  l: string
  t: Tipo
  r?: boolean
  auto?: string
  hint?: string
  opts?: string[]
  items?: { l: string; sub?: Campo[] }[]
  min?: number
  max?: number
  item?: string
  add?: string
  fields?: Campo[]
}
export type Seccion = { title: string; desc?: string; show?: { k: string; v: string }; fields: Campo[] }
export type Formulario = {
  slug: string
  /** "Form. 14". */
  id: number
  /** Para agrupar: "Tecnología", "Recursos Humanos"… */
  area: string
  /** A quién llega. */
  destino: string
  plazo: string | null
  title: string
  intro: string
  notes?: string[]
  sections: Seccion[]
  cambios?: string[]
  /** true = las solicitudes llegan de verdad; false = el envío es de prueba. */
  recibe: boolean
  /** true = «a definir con RRHH»: se gestionará en otro sistema y no puede recibir solicitudes. */
  aDefinir?: boolean
}

/** ¿El formulario es de Recursos Humanos? (cuelga de RRHH; los demás, de la Mesa de Servicios). */
export const esDeRrhh = (area: string) => /recursos humanos|^rrhh$/i.test(area.trim())

/** Áreas, en el orden en que aparecen. */
export const areasDe = (fs: Formulario[]) => [...new Set(fs.map((f) => f.area))]

/** Campos que se muestran al elegir el formulario: cada casilla y sus sub-campos cuentan; los de una lista, una vez. */
export function contarCampos(f: Formulario): number {
  let n = 0
  for (const s of f.sections) {
    for (const c of s.fields) {
      if (c.t === 'checks') for (const it of c.items || []) n += 1 + (it.sub?.length || 0)
      else if (c.t === 'repeat') n += c.fields?.length || 0
      else n++
    }
  }
  return n
}

// ---------- Estado ----------

export type Estado = {
  /** Texto, número, lista y opción única, por ruta. */
  v: Record<string, string>
  /** Casillas marcadas (índices de los ítems), por ruta del grupo. */
  c: Record<string, number[]>
  /** Ítems de cada lista que crece (ids, en orden), por ruta. */
  i: Record<string, number[]>
  /** Próximo id de ítem. */
  sig: number
  /** Rutas completadas con el perfil ("Del perfil"). */
  auto: string[]
}

export type Perfil = Partial<Record<'nombreCompleto' | 'correo' | 'cargo' | 'direccion' | 'extension', string>>

/** Claves de campos hermanos: su `k` o la etiqueta en slug; si se repiten, -2, -3… */
export function claves(campos: Campo[]): string[] {
  const vistas: Record<string, number> = {}
  return campos.map((c) => {
    const base = (c.k || slug(c.l)).replace(/[^a-z0-9-]/gi, '-').toLowerCase() || 'campo'
    vistas[base] = (vistas[base] || 0) + 1
    return vistas[base] === 1 ? base : base + '-' + vistas[base]
  })
}

export const rutaSeccion = (i: number) => 's' + i
export const idCampo = (ruta: string) => 'f_' + ruta

/** Estado al abrir (o al limpiar): el perfil en "Quién solicita" y el mínimo de ítems de cada lista. */
export function estadoInicial(f: Formulario, perfil: Perfil = {}): Estado {
  const e: Estado = { v: {}, c: {}, i: {}, sig: 1, auto: [] }
  const recorrer = (campos: Campo[], base: string) => {
    claves(campos).forEach((clave, n) => {
      const c = campos[n]
      const ruta = base + '_' + clave
      const valor = c.auto ? perfil[c.auto as keyof Perfil]?.trim() : ''
      if (valor) {
        e.v[ruta] = valor
        e.auto.push(ruta)
      }
      if (c.t === 'checks') (c.items || []).forEach((it, j) => it.sub && recorrer(it.sub, ruta + '_c' + j))
      if (c.t === 'repeat') {
        e.i[ruta] = []
        for (let k = 0; k < Math.max(1, c.min || 0); k++) {
          const id = e.sig++
          e.i[ruta].push(id)
          recorrer(c.fields || [], ruta + '_i' + id)
        }
      }
    })
  }
  f.sections.forEach((s, i) => recorrer(s.fields, rutaSeccion(i)))
  return e
}

// ---------- Qué campos están en juego ----------

/** Un campo tal como está en la página: su ruta, su definición y, dentro de una lista, "Participante 2 · ". */
export type Nodo = { ruta: string; campo: Campo; seccion: number; prefijo: string }

/** Valor de la opción única con ese `k` (las condiciones `show` dependen de ella). */
function valorDeRadio(f: Formulario, e: Estado, k: string): string {
  for (let i = 0; i < f.sections.length; i++) {
    const s = f.sections[i]
    const cl = claves(s.fields)
    const n = s.fields.findIndex((c) => c.t === 'radio' && c.k === k)
    if (n >= 0) return e.v[rutaSeccion(i) + '_' + cl[n]] || ''
  }
  return ''
}

/** Secciones que se ven (las condicionales dependen de una opción única), con su número. */
export function seccionesVisibles(f: Formulario, e: Estado): { i: number; n: number; s: Seccion }[] {
  let n = 0
  return f.sections.flatMap((s, i) => (!s.show || valorDeRadio(f, e, s.show.k) === s.show.v ? [{ i, n: ++n, s }] : []))
}

/** Todos los campos que cuentan ahora: sin secciones ocultas, con los sub-campos de las casillas marcadas y los de cada ítem. */
export function activos(f: Formulario, e: Estado): Nodo[] {
  const L: Nodo[] = []
  const recorrer = (campos: Campo[], base: string, seccion: number, prefijo: string) => {
    claves(campos).forEach((clave, n) => {
      const c = campos[n]
      const ruta = base + '_' + clave
      L.push({ ruta, campo: c, seccion, prefijo })
      if (c.t === 'checks') (c.items || []).forEach((it, j) => it.sub && (e.c[ruta] || []).includes(j) && recorrer(it.sub, ruta + '_c' + j, seccion, prefijo))
      if (c.t === 'repeat') (e.i[ruta] || []).forEach((id, k) => recorrer(c.fields || [], ruta + '_i' + id, seccion, prefijo + (c.item || 'Elemento') + ' ' + (k + 1) + ' · '))
    })
  }
  for (const { i, s } of seccionesVisibles(f, e)) recorrer(s.fields, rutaSeccion(i), i, '')
  return L
}

// ---------- Validación (mismas reglas que el prototipo; en una lista se pide "Elige") ----------

const CEDULA = /^(PE|E|N|[1-9]|1[0-3])(AV|PI)?-\d{1,4}-\d{1,6}$/i
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const TELEFONO = /^[0-9][0-9 -]{2,14}$/

export const normalizarCedula = (s: string) => s.trim().toUpperCase()

export function lleno(c: Campo, ruta: string, e: Estado): boolean {
  if (c.t === 'checks') return (e.c[ruta] || []).length > 0
  if (c.t === 'repeat') return (e.i[ruta] || []).length >= (c.min || 0)
  return (e.v[ruta] || '').trim() !== ''
}

/** Mensaje de error del campo, o '' si está bien. */
export function errorDe(c: Campo, ruta: string, e: Estado): string {
  if (c.r && !lleno(c, ruta, e)) {
    return c.t === 'radio' || c.t === 'select'
      ? 'Elige una opción en «' + c.l + '».'
      : c.t === 'checks'
        ? 'Marca al menos una opción en «' + c.l + '».'
        : 'Completa «' + c.l + '».'
  }
  if (c.t === 'radio' || c.t === 'checks' || c.t === 'repeat' || c.t === 'select') return ''
  const v = (e.v[ruta] || '').trim()
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

/** Errores de los campos en juego, en el orden de la página. */
export function errores(f: Formulario, e: Estado): { ruta: string; msg: string }[] {
  return activos(f, e).flatMap(({ ruta, campo }) => {
    const msg = errorDe(campo, ruta, e)
    return msg ? [{ ruta, msg }] : []
  })
}

/** Obligatorios completos (y sin error) en total y por sección visible. */
export function progreso(f: Formulario, e: Estado) {
  const nodos = activos(f, e).filter((x) => x.campo.r)
  const bien = (x: Nodo) => lleno(x.campo, x.ruta, e) && !errorDe(x.campo, x.ruta, e)
  return {
    ok: nodos.filter(bien).length,
    total: nodos.length,
    pasos: seccionesVisibles(f, e).map(({ i, s }) => ({ i, titulo: s.title, hecho: nodos.filter((x) => x.seccion === i).every(bien) })),
  }
}

/** Lo que se mandaría, por sección: "Participante 1 · Nombre completo" → valor. Las listas no se muestran como fila propia. */
export function resumen(f: Formulario, e: Estado): { titulo: string; filas: { dt: string; dd: string }[] }[] {
  const nodos = activos(f, e)
  return seccionesVisibles(f, e).flatMap(({ i, s }) => {
    const filas = nodos
      .filter((x) => x.seccion === i && x.campo.t !== 'repeat')
      .flatMap(({ ruta, campo: c, prefijo }) => {
        const dd = c.t === 'checks' ? (e.c[ruta] || []).map((j) => c.items?.[j]?.l).filter(Boolean).join(', ') : (e.v[ruta] || '').trim()
        return dd ? [{ dt: prefijo + c.l, dd }] : []
      })
    return filas.length ? [{ titulo: s.title, filas }] : []
  })
}

// ---------- Cambios ----------

export function conValor(e: Estado, ruta: string, valor: string): Estado {
  return { ...e, v: { ...e.v, [ruta]: valor } }
}

export function alternarCasilla(e: Estado, ruta: string, j: number): Estado {
  const L = e.c[ruta] || []
  return { ...e, c: { ...e.c, [ruta]: L.includes(j) ? L.filter((x) => x !== j) : [...L, j].sort((a, b) => a - b) } }
}

/** Agrega un ítem (hasta el máximo; 5 si la lista no dice) y devuelve su id. */
export function agregarItem(e: Estado, c: Campo, ruta: string): { estado: Estado; id: number | null } {
  const L = e.i[ruta] || []
  if (L.length >= (c.max || 5)) return { estado: e, id: null }
  const id = e.sig
  return { estado: { ...e, sig: id + 1, i: { ...e.i, [ruta]: [...L, id] } }, id }
}

/** Quita el ítem y todo lo que se escribió en él. */
export function quitarItem(e: Estado, ruta: string, id: number): Estado {
  const pre = ruta + '_i' + id + '_'
  const sin = <T,>(o: Record<string, T>) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith(pre)))
  return { ...e, v: sin(e.v), c: sin(e.c), i: { ...sin(e.i), [ruta]: (e.i[ruta] || []).filter((x) => x !== id) } }
}
