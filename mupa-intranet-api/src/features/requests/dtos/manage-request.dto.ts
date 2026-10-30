import { z } from 'zod'

import { REQUEST_STATUSES } from '../requests.constants.ts'

export const requestParamsDto = z.object({ id: z.coerce.number().int().positive() })

/** Filtros de la bandeja del Gestor. */
export const listRequestsDto = z.object({
  form: z
    .string()
    .regex(/^[a-z0-9-]{1,80}$/)
    .optional(),
  status: z.enum(REQUEST_STATUSES).optional(),
  /** Solo las de un área del Centro de Gestión (hoy, RRHH). */
  area: z.enum(['rrhh']).optional(),
  q: z.string().trim().max(80).optional(),
  /** Solo las atrasadas: abiertas y sin movimiento en OVERDUE_DAYS días (el mismo criterio del Centro de Gestión). */
  overdue: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
})

export const updateRequestStatusDto = z.object({ status: z.enum(REQUEST_STATUSES) }).strict()

/** Respuesta del Gestor a la persona. Solo texto. */
export const createMessageDto = z.object({ body: z.string().trim().min(1, 'Escribe la respuesta.').max(2000) }).strict()

export type RequestParamsDto = z.infer<typeof requestParamsDto>
export type ListRequestsDto = z.infer<typeof listRequestsDto>
export type UpdateRequestStatusDto = z.infer<typeof updateRequestStatusDto>
export type CreateMessageDto = z.infer<typeof createMessageDto>
