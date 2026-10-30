/**
 * Roles de la intranet. En la SPA solo deciden qué se MUESTRA (por ejemplo, el
 * botón "Guardar para todos"); quien de verdad permite o niega es el backend.
 *
 * - admin              administra todo: catálogo, departamentos, diseño del Inicio para todos
 * - comunicacion       contenido: anuncios, noticias, boletines, videos, Inicio
 * - gestorSolicitudes  formularios y las solicitudes que llegan por ellos
 * - funcionario        cualquier persona con sesión ("Usuario")
 */
export const ROLES = ['admin', 'comunicacion', 'gestorSolicitudes', 'funcionario'] as const
export type Rol = (typeof ROLES)[number]

export const ROL_ETIQUETA: Record<Rol, string> = {
  admin: 'Administración',
  comunicacion: 'Comunicación',
  gestorSolicitudes: 'Gestor de Solicitudes',
  funcionario: 'Usuario',
}

export function tieneRol(user: { roles?: string[] | null } | null | undefined, ...roles: Rol[]): boolean {
  return !!user?.roles?.some((r) => (roles as string[]).includes(r))
}
