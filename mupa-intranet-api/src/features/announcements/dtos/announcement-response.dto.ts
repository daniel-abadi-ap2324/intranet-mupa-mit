import { z } from 'zod'

import { STATES } from '../announcements.constants.ts'

/** Lo que ve cualquiera en el Inicio: solo los anuncios vigentes, sin datos de quién los publicó. */
export const announcementResponseDto = z.object({
  id: z.number(),
  title: z.string(),
  body: z.string().nullable(),
  level: z.string(),
  link: z.string().nullable(),
  publishFrom: z.string(),
  publishUntil: z.string().nullable(),
})

/** Lo que ve Comunicación en el panel: además, el estado y la última edición. */
export const managedAnnouncementResponseDto = announcementResponseDto.extend({
  status: z.string(),
  state: z.enum(STATES),
  updatedAt: z.date(),
  /** Nombre de quien lo editó por última vez; null si esa cuenta ya no existe. */
  updatedByName: z.string().nullable(),
})

export type AnnouncementResponse = z.infer<typeof announcementResponseDto>
export type ManagedAnnouncementResponse = z.infer<typeof managedAnnouncementResponseDto>
