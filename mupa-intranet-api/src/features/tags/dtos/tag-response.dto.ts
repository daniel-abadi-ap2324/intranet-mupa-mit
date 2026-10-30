import { z } from 'zod'

export const tagResponseDto = z.object({
  id: z.number(),
  name: z.string(),
  /** true = etiqueta de "para quién" (Uso interno, Ciudadanía, Administración). */
  audience: z.boolean(),
})

export type TagResponse = z.infer<typeof tagResponseDto>
