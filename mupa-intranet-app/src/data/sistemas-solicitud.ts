/**
 * Solicitudes que ya tienen su propio sistema, fuera de la intranet (los mismos
 * botones del Inicio de la intranet actual). No son formularios de la intranet:
 * la tarjeta abre el sistema en una pestaña nueva.
 */
export type SistemaSolicitud = { t: string; p: string; g: string; color: string; h: string }

export const SISTEMAS_SOLICITUD: SistemaSolicitud[] = [
  { t: 'Código de llamadas', p: 'Solicita el PIN para marcación externa en tu extensión.', g: '☏', color: 'cian', h: 'https://cdr.mupa.gob.pa/pinrequests/create' },
  { t: 'Acceso a la red WIFI', p: 'Solicita el acceso a la red institucional para tu equipo asignado.', g: '◈', color: 'morado', h: 'http://wifi.mupa.gob.pa:9001/solicitud' },
]

/** Área de los formularios de Tecnología, donde van también estos sistemas. */
export const AREA_SISTEMAS = 'Tecnología'
