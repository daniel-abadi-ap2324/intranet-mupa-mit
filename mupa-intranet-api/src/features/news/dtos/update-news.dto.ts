import { z } from 'zod'

import { newsFields } from './create-news.dto.ts'

export const updateNewsDto = z
  .object(newsFields)
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: 'Envía al menos un campo para cambiar.' })

export type UpdateNewsDto = z.infer<typeof updateNewsDto>
