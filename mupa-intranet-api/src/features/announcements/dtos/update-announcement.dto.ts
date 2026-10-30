import { z } from 'zod'

import { announcementFields } from './create-announcement.dto.ts'

export const updateAnnouncementDto = z
  .object(announcementFields)
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: 'Envía al menos un campo para cambiar.' })

export type UpdateAnnouncementDto = z.infer<typeof updateAnnouncementDto>
