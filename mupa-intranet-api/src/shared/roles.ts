/**
 * Roles de la intranet (los mismos que el frontend, lib/roles.ts).
 * - admin              administra todo: catálogo, departamentos, diseño del Inicio para todos
 * - comunicacion       contenido: anuncios, noticias, boletines, videos, Inicio
 * - gestorSolicitudes  formularios y las solicitudes que llegan por ellos
 * - funcionario        cualquier persona con sesión ("Usuario")
 */
export const ROLES = ['admin', 'comunicacion', 'gestorSolicitudes', 'funcionario'] as const
export type Role = (typeof ROLES)[number]

export function hasRole(user: { roles: string[] } | null | undefined, ...roles: Role[]): boolean {
  return !!user?.roles.some((r) => (roles as readonly string[]).includes(r))
}

/** Quién edita el catálogo de aplicaciones. */
export const CATALOG_EDITORS: Role[] = ['admin']

/** Quién publica el contenido (anuncios, noticias, boletines…): Comunicación (y administración). */
export const CONTENT_EDITORS: Role[] = ['admin', 'comunicacion']

/** Quién crea formularios. */
export const REQUEST_MANAGERS: Role[] = ['admin', 'gestorSolicitudes']

/** Todos los que gestionan algo: entran al Centro de Gestión. */
export const GESTORES: Role[] = ['admin', 'comunicacion', 'gestorSolicitudes']

/**
 * Áreas del Centro de Gestión y quién ve (y atiende) cada una cuando se separen.
 * Por ahora TODOS_VEN_TODO: cualquier gestor ve y responde todo. Para separarlas,
 * se pone en false (aquí y en la web, lib/gestion.ts) y, cuando Identity Central
 * tenga el rol de RRHH, se agrega a ROLES y a "rrhh".
 */
export const TODOS_VEN_TODO = true
export const AREAS_GESTION = {
  solicitudes: ['admin', 'gestorSolicitudes'],
  rrhh: ['admin', 'gestorSolicitudes'],
  comunicacion: ['admin', 'comunicacion'],
  administracion: ['admin'],
} satisfies Record<string, Role[]>
export type AreaGestion = keyof typeof AREAS_GESTION

export function veArea(user: { roles: string[] } | null | undefined, area: AreaGestion): boolean {
  return TODOS_VEN_TODO ? hasRole(user, ...GESTORES) : hasRole(user, ...AREAS_GESTION[area])
}

/** Quién atiende las solicitudes (la bandeja, el estado y las respuestas). */
export const REQUEST_HANDLERS: Role[] = TODOS_VEN_TODO ? GESTORES : ['admin', 'gestorSolicitudes']

/**
 * `app_role` de Identity Central (el rol de la persona EN esta aplicación) → roles
 * de la intranet. Los nombres de la izquierda se acuerdan con el equipo de Identity
 * Central; se comparan sin mayúsculas, tildes, espacios ni guiones ("Gestor Solicitudes" = "gestorsolicitudes").
 * El rol por defecto de la app en el central es "User".
 */
const APP_ROLES: Record<string, Role> = {
  admin: 'admin',
  comunicacion: 'comunicacion',
  gestorsolicitudes: 'gestorSolicitudes',
  user: 'funcionario',
  funcionario: 'funcionario',
}

/** Un app_role desconocido (o ninguno) no da permisos de más: queda como funcionario. */
export function rolesFromAppRoles(appRoles: string[]): Role[] {
  const key = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s_-]+/g, '').toLowerCase()
  const roles = [...new Set(appRoles.map((r) => APP_ROLES[key(r)]).filter((r): r is Role => !!r))]
  return roles.length ? roles : ['funcionario']
}
