import { z } from 'zod'

import { applicationFields } from './create-application.dto.ts'

export const updateApplicationDto = z
  .object(applicationFields)
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: 'Envía al menos un campo para cambiar.' })

export type UpdateApplicationDto = z.infer<typeof updateApplicationDto>
