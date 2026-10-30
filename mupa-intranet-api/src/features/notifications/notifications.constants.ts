/** Cada cuánto se manda un latido (`: ping`): pasa el timeout de nginx y avisa al navegador que sigue vivo. */
export const LATIDO_MS = 25_000

/**
 * Cuánto dura como mucho un stream. Al cerrarse, EventSource reconecta solo y vuelve
 * a pasar por la autenticación: un logout, un cambio de rol o una sesión vencida
 * dejan de recibir en como mucho este tiempo.
 */
export const DURACION_MAX_MS = 15 * 60_000

/** Solicitudes nuevas que lista la campana (el total va aparte). */
export const MAX_EN_CAMPANA = 20

/** Conexiones abiertas a la vez por persona (una por pestaña). */
export const MAX_POR_PERSONA = 5
