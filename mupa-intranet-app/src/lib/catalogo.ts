/**
 * Catálogo de aplicaciones: tipos y utilidades compartidas por el sitio, el
 * panel (vista previa) y el seed. Misma lógica que mupa-apps.js del prototipo.
 */

export const AREAS = ['Trámites', 'Soporte', 'Personal', 'Atención', 'Finanzas', 'Operaciones'] as const
export type Area = (typeof AREAS)[number]

export const AUDIENCIAS = ['Uso interno', 'Ciudadanía', 'Administración'] as const

/** Tinte y color del icono por área (tokens del design system). */
export const TINTES: Record<string, { tint: string; color: string }> = {
  Trámites: { tint: 'var(--color-cyan-100)', color: 'var(--color-cyan-400)' },
  Soporte: { tint: 'var(--color-purple-100)', color: 'var(--color-purple-400)' },
  Personal: { tint: 'var(--color-coral-100)', color: 'var(--color-coral-400)' },
  Atención: { tint: 'var(--color-lime-100)', color: 'var(--color-lime-400)' },
  Finanzas: { tint: 'var(--action-subtle)', color: 'var(--action)' },
  Operaciones: { tint: 'var(--color-warning-100)', color: 'var(--color-warning-700)' },
}

export const ACCESOS = [
  { label: 'Todas las personas', value: 'todos' },
  { label: 'Solo con la sesión iniciada (paneles de administración)', value: 'sesion' },
  { label: 'Solo red interna (se muestra sin enlace)', value: 'red-interna' },
] as const

export const ESTADOS = [
  { label: 'Funciona', value: 'publicado' },
  { label: 'Pendiente (se muestra marcada)', value: 'pendiente' },
  { label: 'Solo desde la red interna', value: 'solo-red-interna' },
] as const

export const ESTADO_TEXTO: Record<string, string> = {
  pendiente: 'Pendiente',
  'solo-red-interna': 'Solo red interna',
}

/** Aplicación tal como la usa el sitio (forma plana, sin datos del panel). */
/** Qué hay en cada área (se muestra al pasar el mouse por el filtro), según el catálogo actual. */
export const AREA_DESCRIPCION: Record<string, string> = {
  Trámites: 'Trámites y documentos: ARI, TRANSDOC, gestión documental, registros',
  Soporte: 'Tecnología: correo, soporte, códigos de llamadas, WIFI y accesos',
  Personal: 'Recursos Humanos y Clínica: cartas, certificaciones, RRHH Express, citas',
  Atención: 'Servicios a la ciudadanía: gestión social, denuncias, encuestas, reciclaje',
  Finanzas: 'Pagos y cobros',
  Operaciones: 'Compras, transporte, visitas, proveedores y paneles de administración',
}

export type App = {
  id: string
  name: string
  desc: string
  cat: string
  g: string
  h: string | null
  tags: string[]
  k: string
  confirmado: boolean
  ext?: boolean
  pdf?: boolean
  status?: string
  acceso?: 'sesion'
  origen?: string
  /** «Acceso rápido por defecto» del catálogo: las que más se usan; van primero. */
  destacada?: boolean
}

/** Orden de la página Aplicaciones: primero las más usadas (destacadas), luego el resto y al final los paneles de administración. */
export function rangoApp(a: App): number {
  if (a.acceso === 'sesion' || /^Administración\s·/.test(a.name)) return 2
  return a.destacada ? 0 : 1
}

export type Etiqueta = { name: string; slug: string; count: number; audiencia: boolean }

/** "Recursos Humanos" → "recursos-humanos". */
export function slug(s: string): string {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Texto sin tildes y en minúsculas, para buscar "tramites" y encontrar "Trámites". */
export function norm(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/** Etiquetas con su cantidad: primero "para quién", luego temas por frecuencia. */
export function etiquetas(apps: App[]): Etiqueta[] {
  const n: Record<string, number> = {}
  apps.forEach((a) => a.tags.forEach((t) => (n[t] = (n[t] || 0) + 1)))
  const aud = AUDIENCIAS as readonly string[]
  return Object.keys(n)
    .map((t) => ({ name: t, slug: slug(t), count: n[t], audiencia: aud.includes(t) }))
    .sort((x, y) => {
      if (x.audiencia !== y.audiencia) return x.audiencia ? -1 : 1
      if (x.audiencia) return aud.indexOf(x.name) - aud.indexOf(y.name)
      return y.count - x.count || x.name.localeCompare(y.name, 'es')
    })
}
