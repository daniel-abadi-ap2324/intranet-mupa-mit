import { z } from 'zod'

/** GET /api/meta/content: la pregunta (o las palabras) y cuántos resultados. */
export const contentQueryDto = z.object({
  q: z.string().trim().min(2).max(300),
  limit: z.coerce.number().int().min(1).max(10).default(5),
})

export type ContentQueryDto = z.infer<typeof contentQueryDto>
