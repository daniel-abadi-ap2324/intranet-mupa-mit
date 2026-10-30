import { z } from 'zod'

export const departmentParamsDto = z.object({ id: z.coerce.number().int().positive() })

export type DepartmentParamsDto = z.infer<typeof departmentParamsDto>
