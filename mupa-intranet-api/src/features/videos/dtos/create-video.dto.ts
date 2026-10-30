import { z } from 'zod'

import { urlDto } from '../../../shared/dtos/url.dto.ts'
import { VIDEO_CATEGORIES } from '../videos.constants.ts'

const day = z.iso.date('Usa una fecha con el formato AAAA-MM-DD.')

/** Campos que se pueden escribir. */
export const videoFields = {
  title: z.string().trim().min(1).max(160),
  /** YouTube, un MP4 de /sitio/… o de otro sitio con dominio. Se abre en otra pestaña. */
  url: urlDto.refine((url) => url !== null, { message: 'Escribe la dirección del video.' }),
  category: z.enum(VIDEO_CATEGORIES).optional(),
  description: z.string().trim().max(160).optional(),
  date: day.nullable().optional(),
  published: z.boolean().optional(),
}

export const createVideoDto = z.object(videoFields).strict()

export type CreateVideoDto = z.infer<typeof createVideoDto>
