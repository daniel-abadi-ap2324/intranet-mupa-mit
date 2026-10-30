/**
 * Clasificar qué departamentos (direcciones) ven qué aplicaciones, en bloque.
 * La regla de la API: una aplicación sin departamentos la ven todas las personas;
 * con departamentos, solo esos (y administración). Aquí vive esa semántica para que
 * las dos vistas (por aplicación y por dirección) la usen igual.
 */

export type Unidad = { id: number; name: string }

export const GRUPOS = [
  { id: 'direcciones', t: 'Direcciones' },
  { id: 'juntas', t: 'Juntas Comunales' },
  { id: 'departamentos', t: 'Departamentos' },
  { id: 'oficinas', t: 'Oficinas y despachos' },
  { id: 'otras', t: 'Otras unidades' },
] as const
export type GrupoId = (typeof GRUPOS)[number]['id']

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** El tipo de unidad sale del comienzo del nombre («Junta Comunal de…», «Dirección de…»). */
export function grupoDe(nombre: string): GrupoId {
  const n = sinTildes(nombre).trim()
  if (/^(sub-?\s?)?direccion\b/.test(n)) return 'direcciones'
  if (/^junta/.test(n)) return 'juntas'
  if (/^departamento\b/.test(n)) return 'departamentos'
  if (/^(oficina|despacho|secretaria|concejo|tesoreria)\b/.test(n)) return 'oficinas'
  return 'otras'
}

/** Las unidades repartidas por grupo, en el orden de GRUPOS y sin grupos vacíos. */
export function agrupar(unidades: Unidad[]): { id: GrupoId; t: string; unidades: Unidad[] }[] {
  return GRUPOS.map((g) => ({ ...g, unidades: unidades.filter((u) => grupoDe(u.name) === g.id) })).filter((g) => g.unidades.length)
}

/** Sin departamentos = la ven todas las personas. */
export const paraTodas = (ids: number[]) => ids.length === 0

/** ¿La ve una persona de este departamento? */
export const laVe = (ids: number[], departamento: number) => ids.length === 0 || ids.includes(departamento)

/** Cuántas de las `total` direcciones la ven. */
export const cuantasVen = (ids: number[], total: number) => (ids.length === 0 ? total : Math.min(ids.length, total))

const mismos = (a: number[], b: number[]) => a.length === b.length && a.every((x) => b.includes(x))
export const igualesIds = mismos

/** Si la lista cubre a todas las direcciones, equivale a «todas» (se guarda vacía). */
export function normalizar(ids: number[], todas: number[]): number[] {
  const unicos = [...new Set(ids)].filter((id) => todas.includes(id))
  return unicos.length >= todas.length ? [] : unicos
}

export type Cambio = { ids: number[]; aviso?: string } | { bloqueado: string }

/**
 * Prende o apaga que un departamento vea una aplicación.
 *  - Apagar en una aplicación «para todas» la deja en «todas menos esta».
 *  - Apagar a la única dirección que la ve se bloquea: sin direcciones sería «todas».
 */
export function poner(ids: number[], departamento: number, ve: boolean, todas: number[]): Cambio {
  if (ve === laVe(ids, departamento)) return { ids }
  if (ve) return { ids: normalizar([...ids, departamento], todas) }
  if (paraTodas(ids)) return { ids: todas.filter((x) => x !== departamento), aviso: `Antes la veían todas las direcciones; ahora solo las otras ${todas.length - 1}.` }
  if (ids.length === 1) return { bloqueado: 'Es la única dirección que la ve: quitarla la abriría a todas. Para que no la vea nadie, déjala como borrador.' }
  return { ids: ids.filter((x) => x !== departamento) }
}

/** Marca o desmarca un grupo de direcciones dentro de una selección (una aplicación «solo estas»). */
export function ponerGrupo(ids: number[], grupo: number[], marcar: boolean): number[] {
  return marcar ? [...new Set([...ids, ...grupo])] : ids.filter((x) => !grupo.includes(x))
}
