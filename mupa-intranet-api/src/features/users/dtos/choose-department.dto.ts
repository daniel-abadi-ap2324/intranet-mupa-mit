import { z } from 'zod'

/** La persona elige su propio departamento (solo cuando todavía no tiene uno). */
export const chooseDepartmentDto = z.object({ departmentId: z.number().int().positive() }).strict()

export type ChooseDepartmentDto = z.infer<typeof chooseDepartmentDto>
