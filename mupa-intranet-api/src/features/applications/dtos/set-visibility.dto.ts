import { z } from 'zod'

const id = z.number().int().positive()

/** Varias aplicaciones a la vez: a cada una, los departamentos que la ven (lista vacía = la ven todos). */
export const setVisibilityDto = z
  .array(z.object({ applicationId: id, departmentIds: z.array(id).max(500) }).strict())
  .min(1, 'Envía al menos una aplicación.')
  .max(500)
  .refine((items) => new Set(items.map((i) => i.applicationId)).size === items.length, { message: 'Una aplicación no puede repetirse.' })

export type SetVisibilityDto = z.infer<typeof setVisibilityDto>

export const visibilityResponseDto = z.object({ updated: z.number().int() })
