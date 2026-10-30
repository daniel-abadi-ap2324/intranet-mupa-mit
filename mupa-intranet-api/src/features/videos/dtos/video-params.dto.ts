import { z } from 'zod'

export const videoParamsDto = z.object({ id: z.coerce.number().int().positive() })

export type VideoParamsDto = z.infer<typeof videoParamsDto>
