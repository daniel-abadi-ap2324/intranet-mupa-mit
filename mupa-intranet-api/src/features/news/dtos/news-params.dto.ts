import { z } from 'zod'

export const newsParamsDto = z.object({ id: z.coerce.number().int().positive() })

export type NewsParamsDto = z.infer<typeof newsParamsDto>
