import { z } from 'zod'

import { ACCESS_LEVELS, AREAS, STATUSES } from '../applications.constants.ts'
import { appUrlDto } from '../../../shared/dtos/url.dto.ts'

/** Campos que se pueden escribir. El slug no: se genera del nombre y no cambia (lo usan los favoritos). */
export const applicationFields = {
  name: z.string().trim().min(1).max(80),
  // Puede ir vacía: si no se sabe para qué sirve la aplicación, mejor nada que una descripción inventada.
  description: z.string().trim().max(160),
  url: appUrlDto.nullable().optional(),
  area: z.enum(AREAS),
  icon: z.string().trim().min(1).max(4).optional(),
  tagIds: z.array(z.number().int().positive()).max(30).optional(),
  /** Departamentos que la ven. Vacío o sin enviar = la ven todos (según `access`). */
  departmentIds: z.array(z.number().int().positive()).max(60).optional(),
  access: z.enum(ACCESS_LEVELS).optional(),
  status: z.enum(STATUSES).optional(),
  external: z.boolean().optional(),
  pdf: z.boolean().optional(),
  featured: z.boolean().optional(),
  confirmed: z.boolean().optional(),
  keywords: z.string().trim().max(300).optional(),
  note: z.string().trim().max(500).optional(),
  published: z.boolean().optional(),
}

export const createApplicationDto = z.object(applicationFields).strict()

export type CreateApplicationDto = z.infer<typeof createApplicationDto>
