/** Estados de una solicitud: recibida (nueva), en revisión, resuelta o rechazada. */
export const REQUEST_STATUSES = ['recibida', 'en_revision', 'resuelta', 'rechazada'] as const
export type RequestStatus = (typeof REQUEST_STATUSES)[number]

/** Eventos de la línea de tiempo. */
export const EVENT_TYPES = ['creada', 'estado', 'mensaje'] as const

/** Envíos por persona por hora (para frenar abusos o un botón pulsado de más). */
export const MAX_REQUESTS_PER_HOUR = 10

/** Estados abiertos: todavía hay que hacer algo. */
export const OPEN_STATUSES: RequestStatus[] = ['recibida', 'en_revision']

/** Una solicitud abierta sin movimiento en estos días está atrasada (Centro de Gestión y filtro `overdue` de la bandeja). */
export const OVERDUE_DAYS = 3

/** Cómo aparece el área de RRHH en los formularios (en minúsculas). El filtro `area=rrhh` de la bandeja la usa. */
export const RRHH_AREA_NAMES = ['recursos humanos', 'rrhh']
