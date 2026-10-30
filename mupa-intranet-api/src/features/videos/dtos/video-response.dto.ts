import { z } from 'zod'

/** Lo que ve cualquiera: solo lo publicado, sin datos de quién lo editó. */
export const videoResponseDto = z.object({
  id: z.number(),
  title: z.string(),
  url: z.string(),
  category: z.string(),
  description: z.string(),
  date: z.string().nullable(),
})

/** Lo que ve Comunicación en su panel: además, si está publicado y la última edición. */
export const managedVideoResponseDto = videoResponseDto.extend({
  published: z.boolean(),
  updatedAt: z.date(),
  /** Nombre de quien lo editó por última vez; null si esa cuenta ya no existe. */
  updatedByName: z.string().nullable(),
})
