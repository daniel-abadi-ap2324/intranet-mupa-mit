import { z } from 'zod'

const base = {
  id: z.number(),
  folio: z.string(),
  formTitle: z.string(),
  formArea: z.string(),
  status: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
}

/** "Mis solicitudes": `unread` = el Gestor respondió o cambió el estado después de la última vez que la abrió. */
export const myRequestResponseDto = z.object({ ...base, unread: z.boolean() })

/** Bandeja del Gestor. */
export const managedRequestResponseDto = z.object({
  ...base,
  ownerName: z.string(),
  ownerEmail: z.string().nullable(),
  ownerDepartment: z.string().nullable(),
})

/** Detalle: lo que se pidió y la línea de tiempo. */
export const requestDetailResponseDto = managedRequestResponseDto.extend({
  summary: z.array(z.object({ titulo: z.string(), filas: z.array(z.object({ dt: z.string(), dd: z.string() })) })),
  events: z.array(
    z.object({
      id: z.number(),
      type: z.string(),
      status: z.string().nullable(),
      body: z.string().nullable(),
      authorName: z.string().nullable(),
      /** true = lo hizo el Gestor (no la persona que pidió). */
      fromStaff: z.boolean(),
      createdAt: z.date(),
    }),
  ),
})
