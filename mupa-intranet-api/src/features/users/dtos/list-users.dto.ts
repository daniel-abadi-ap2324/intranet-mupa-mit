import { z } from 'zod'

/** Filtros del panel: por departamento, solo quienes no tienen, y búsqueda por nombre, correo o cédula. */
export const listUsersDto = z.object({
  department: z.coerce.number().int().positive().optional(),
  withoutDepartment: z.stringbool().default(false),
  q: z.string().trim().max(80).optional(),
})

export type ListUsersDto = z.infer<typeof listUsersDto>
