import { z } from 'zod'

import { formFields } from './create-form.dto.ts'

export const updateFormDto = z
  .object(formFields)
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: 'Envía al menos un campo para cambiar.' })

export type UpdateFormDto = z.infer<typeof updateFormDto>
