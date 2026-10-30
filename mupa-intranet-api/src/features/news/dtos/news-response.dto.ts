import { z } from 'zod'

/** Lo que ve cualquiera: solo lo publicado, sin datos de quién lo editó. */
export const newsResponseDto = z.object({
  id: z.number(),
  title: z.string(),
  summary: z.string().nullable(),
  type: z.string(),
  date: z.string(),
  link: z.string().nullable(),
  imageUrl: z.string().nullable(),
  /** Si se puede leer completa dentro de la intranet (GET /news/:id). La lista no trae el texto. */
  hasBody: z.boolean(),
})

/** Una noticia para leerla: lo de la lista y su texto (párrafos separados por una línea en blanco). */
export const newsDetailResponseDto = newsResponseDto.extend({ body: z.string() })

/** Lo que ve Comunicación en su panel: además, si está publicado y la última edición. */
export const managedNewsResponseDto = newsResponseDto.extend({
  status: z.string(),
  updatedAt: z.date(),
  /** Nombre de quien lo editó por última vez; null si esa cuenta ya no existe. */
  updatedByName: z.string().nullable(),
})
