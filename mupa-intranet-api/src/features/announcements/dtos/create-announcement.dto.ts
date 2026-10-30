import { z } from 'zod'

import { httpsUrlDto } from '../../../shared/dtos/url.dto.ts'
import { LEVELS, STATUSES } from '../announcements.constants.ts'

/** Fecha sin hora, "AAAA-MM-DD". */
const day = z.iso.date('Usa una fecha con el formato AAAA-MM-DD.')

/** Campos que se pueden escribir. Solo texto: no se acepta HTML. */
export const announcementFields = {
  title: z.string().trim().min(1).max(120),
  body: z
    .string()
    .trim()
    .max(500)
    .transform((s) => s || null)
    .nullable()
    .optional(),
  level: z.enum(LEVELS).optional(),
  link: httpsUrlDto.nullable().optional(),
  status: z.enum(STATUSES).optional(),
  /** Sin fecha: desde hoy. */
  publishFrom: day.optional(),
  /** null = no vence. Inclusiva: el anuncio se ve también ese día. */
  publishUntil: day.nullable().optional(),
}

export const createAnnouncementDto = z.object(announcementFields).strict()

export type CreateAnnouncementDto = z.infer<typeof createAnnouncementDto>
