import { z } from 'zod'

import { videoFields } from './create-video.dto.ts'

export const updateVideoDto = z
  .object(videoFields)
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: 'Envía al menos un campo para cambiar.' })

export type UpdateVideoDto = z.infer<typeof updateVideoDto>
