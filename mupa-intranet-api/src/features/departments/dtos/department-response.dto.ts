import { z } from 'zod'

export const departmentResponseDto = z.object({
  id: z.number(),
  name: z.string(),
  /** Personas con este departamento. */
  users: z.number(),
  /** Aplicaciones restringidas a este departamento (entre otros). */
  applications: z.number(),
})

export type DepartmentResponse = z.infer<typeof departmentResponseDto>
