/** Valores del catálogo: los mismos que usa el frontend (src/lib/catalogo.ts). */
export const AREAS = ['Trámites', 'Soporte', 'Personal', 'Atención', 'Finanzas', 'Operaciones'] as const

/** Quién ve la aplicación: todas las personas, solo con sesión, o se lista sin enlace (red interna). */
export const ACCESS_LEVELS = ['todos', 'sesion', 'red-interna'] as const

/** Estado del sistema: funciona, pendiente (se muestra marcada) o solo desde la red interna. */
export const STATUSES = ['publicado', 'pendiente', 'solo-red-interna'] as const
