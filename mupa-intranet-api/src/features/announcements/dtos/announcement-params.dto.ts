import { z } from 'zod'

export const announcementParamsDto = z.object({ id: z.coerce.number().int().positive() })

export type AnnouncementParamsDto = z.infer<typeof announcementParamsDto>
