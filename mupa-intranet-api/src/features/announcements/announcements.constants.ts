/** Urgencia del anuncio (el color de la marca en el Inicio). Mismos valores que el frontend. */
export const LEVELS = ['urgente', 'importante', 'normal'] as const

/** Lo que decide Comunicación: borrador, publicado, o retirado (sale del Inicio sin borrarse). */
export const STATUSES = ['borrador', 'publicado', 'retirado'] as const

/**
 * Estado que se ve en el panel, calculado con las fechas: un "publicado" puede
 * estar vigente, programado (empieza después) o vencido (ya pasó su fecha final).
 */
export const STATES = ['vigente', 'programado', 'vencido', 'borrador', 'retirado'] as const

export type Level = (typeof LEVELS)[number]
export type Status = (typeof STATUSES)[number]
export type State = (typeof STATES)[number]
