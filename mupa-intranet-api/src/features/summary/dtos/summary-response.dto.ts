import { z } from 'zod'

/** Cifras de los paneles de gestión. Solo vienen las de los roles de quien pregunta. */
export const summaryResponseDto = z.object({
  /** Administración: personas a las que falta asignar departamento. */
  usersWithoutDepartment: z.number().optional(),
  /** Comunicación: anuncios que hoy se ven en el Inicio, y borradores. */
  activeAnnouncements: z.number().optional(),
  draftAnnouncements: z.number().optional(),
  /** Gestor de Solicitudes: solicitudes nuevas (recibidas, sin atender). */
  newRequests: z.number().optional(),
  /** Cualquiera: sus solicitudes con una respuesta o un cambio que todavía no vio (la campana). */
  unreadRequests: z.number(),
})

export type SummaryResponse = z.infer<typeof summaryResponseDto>
