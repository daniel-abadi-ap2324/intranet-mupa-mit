import { z } from 'zod'

export const fileResponseDto = z.object({
  id: z.number(),
  /** Dirección para usar en un boletín o una noticia (/api/files/ID/nombre.pdf). */
  url: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number(),
})

export type FileResponse = z.infer<typeof fileResponseDto>
