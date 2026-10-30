/** Comprobantes por página en el historial. */
export const PAYSLIPS_PER_PAGE = 12

/** Clave propia para cifrar el token de RH Link (separada de la del refresh token de Identity Central). */
export const TOKEN_PURPOSE = 'mupa-intranet:rrhh-express'

/** Las dos bolsas de tiempo compensatorio de RH Link: entrada anticipada y sobretiempo. */
export const COMP_TYPES = ['ANTES', 'DESPUES'] as const
export const COMP_UNITS = ['HORAS', 'DIAS'] as const

/** Clave propia para cifrar el token de RH Link de un invitado (con la cookie `mupa_invitado`). */
export const GUEST_TOKEN_PURPOSE = 'mupa-intranet:rrhh-guest'

/**
 * Conexión de invitado: se cierra tras 30 minutos sin usarla (cada consulta la renueva), nunca dura
 * más de 2 horas desde que se abrió ni más que el token de RH Link.
 */
export const GUEST_IDLE_MINUTES = 30
export const GUEST_MAX_MINUTES = 120

/** Fallos al conectar: 5 cada 15 minutos por cédula (sin importar IP ni sesión) y 20 por IP. */
export const CONNECT_LIMIT_CEDULA = { max: 5, windowMs: 15 * 60_000 }
export const CONNECT_LIMIT_IP = { max: 20, windowMs: 15 * 60_000 }
