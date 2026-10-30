import { z } from 'zod'

export const applicationParamsDto = z.object({ id: z.coerce.number().int().positive() })

export type ApplicationParamsDto = z.infer<typeof applicationParamsDto>
