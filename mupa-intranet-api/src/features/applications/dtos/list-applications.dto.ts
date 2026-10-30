import { z } from 'zod'

/**
 * Solo para quien edita el catálogo:
 *  - ?includeDrafts=true incluye los borradores;
 *  - ?department=ID muestra lo que ve una persona de ese departamento.
 */
export const listApplicationsDto = z.object({
  includeDrafts: z.stringbool().default(false),
  department: z.coerce.number().int().positive().optional(),
})

export type ListApplicationsDto = z.infer<typeof listApplicationsDto>
