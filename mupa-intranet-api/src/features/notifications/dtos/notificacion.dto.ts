import { z } from 'zod'

/** Lo que sale por el stream con `event: solicitud.creada`. Sin cédula ni respuestas del formulario. */
export const notificacionSolicitudDto = z.object({
  id: z.number(),
  folio: z.string(),
  formulario: z.string(),
  area: z.string(),
  solicitante: z.string(),
  fecha: z.date(),
})

export type NotificacionSolicitud = z.infer<typeof notificacionSolicitudDto>

/** GET /api/notifications: las solicitudes nuevas sin atender (la campana de admin y Gestor). */
export const notificacionesResponseDto = z.object({
  total: z.number(),
  items: z.array(notificacionSolicitudDto),
})
