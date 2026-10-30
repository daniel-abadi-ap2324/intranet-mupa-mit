import { z } from 'zod'

const contador = z.object({ total: z.number(), open: z.number() })

/**
 * Centro de Gestión: las cifras de cada área. Una sección falta si la edición la
 * apaga (publicación: sin solicitudes, anuncios, noticias ni videos) o si quien
 * pregunta no ve esa área (hoy todos los gestores ven todo).
 */
export const panelResponseDto = z.object({
  generatedAt: z.date(),
  /** Días que abarcan los periodos ("últimos N días"). */
  periodDays: z.number(),
  /** Días sin movimiento del personal para que una solicitud abierta cuente como atrasada. */
  overdueDays: z.number(),
  requests: z
    .object({
      byStatus: z.object({ recibida: z.number(), en_revision: z.number(), resuelta: z.number(), rechazada: z.number() }),
      open: z.number(),
      overdue: z.number(),
      /** Promedio, en horas, desde que llega hasta la primera respuesta o cambio de estado (las del periodo). */
      firstResponseHours: z.number().nullable(),
      received: z.number(),
      resolved: z.number(),
      /** Una por día del periodo, de la más vieja a hoy (fecha de Panamá). */
      daily: z.array(z.object({ date: z.string(), n: z.number() })),
      byArea: z.array(contador.extend({ area: z.string(), rrhh: z.boolean() })),
      byForm: z.array(contador.extend({ area: z.string(), form: z.string(), rrhh: z.boolean() })),
      overdueList: z.array(z.object({ id: z.number(), folio: z.string(), formTitle: z.string(), ownerName: z.string(), status: z.string(), createdAt: z.date() })),
    })
    .optional(),
  communication: z
    .object({
      announcements: z
        .object({
          vigente: z.number(),
          programado: z.number(),
          vencido: z.number(),
          borrador: z.number(),
          retirado: z.number(),
          /** Vigentes que dejan de verse en los próximos días. */
          expiring: z.array(z.object({ id: z.number(), title: z.string(), publishUntil: z.string() })),
        })
        .optional(),
      news: z.object({ published: z.number(), drafts: z.number(), recent: z.number() }).optional(),
      videos: z.object({ published: z.number(), total: z.number() }).optional(),
      bulletins: z.object({ published: z.number(), total: z.number(), latest: z.string().nullable() }),
    })
    .optional(),
  administration: z
    .object({
      users: z.object({ total: z.number(), active: z.number(), created: z.number(), withoutDepartment: z.number(), unverifiedEmail: z.number() }),
      applications: z.object({ published: z.number(), drafts: z.number() }),
      departments: z.number(),
    })
    .optional(),
  /** Lo último que pasó, de lo más nuevo a lo más viejo. */
  activity: z.array(
    z.object({
      kind: z.enum(['solicitud', 'anuncio', 'noticia', 'boletin', 'video']),
      /** solicitud: creada | estado | mensaje; contenido: editado. */
      action: z.string(),
      title: z.string(),
      status: z.string().nullable(),
      who: z.string().nullable(),
      at: z.date(),
      /** Solicitud: su id (se abre en la bandeja). */
      requestId: z.number().nullable(),
    }),
  ),
})

export type PanelResponse = z.infer<typeof panelResponseDto>
export type Actividad = PanelResponse['activity'][number]
