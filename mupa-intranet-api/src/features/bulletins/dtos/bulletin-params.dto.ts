import { z } from 'zod'

export const bulletinParamsDto = z.object({ id: z.coerce.number().int().positive() })

export type BulletinParamsDto = z.infer<typeof bulletinParamsDto>
