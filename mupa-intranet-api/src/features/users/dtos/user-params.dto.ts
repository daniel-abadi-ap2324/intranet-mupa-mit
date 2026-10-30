import { z } from 'zod'

export const userParamsDto = z.object({ id: z.coerce.number().int().positive() })

export type UserParamsDto = z.infer<typeof userParamsDto>
