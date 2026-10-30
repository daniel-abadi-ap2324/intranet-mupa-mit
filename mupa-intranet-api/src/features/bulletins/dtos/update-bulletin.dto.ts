import { z } from 'zod'

import { bulletinFields } from './create-bulletin.dto.ts'

export const updateBulletinDto = z
  .object(bulletinFields)
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: 'Envía al menos un campo para cambiar.' })

export type UpdateBulletinDto = z.infer<typeof updateBulletinDto>
