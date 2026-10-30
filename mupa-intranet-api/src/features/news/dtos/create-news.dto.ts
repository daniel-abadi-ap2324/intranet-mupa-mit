import { z } from 'zod'

import { urlDto } from '../../../shared/dtos/url.dto.ts'
import { NEWS_STATUSES, NEWS_TYPES } from '../news.constants.ts'

const day = z.iso.date('Usa una fecha con el formato AAAA-MM-DD.')
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => s || null)
    .nullable()
    .optional()

/** Campos que se pueden escribir. Solo texto: no se acepta HTML. */
export const newsFields = {
  title: z.string().trim().min(1).max(160),
  summary: optionalText(500),
  type: z.enum(NEWS_TYPES).optional(),
  date: day,
  link: urlDto.nullable().optional(),
  imageUrl: urlDto.nullable().optional(),
  status: z.enum(NEWS_STATUSES).optional(),
}

export const createNewsDto = z.object(newsFields).strict()

export type CreateNewsDto = z.infer<typeof createNewsDto>
