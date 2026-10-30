import { z } from 'zod'

import { urlDto } from '../../../shared/dtos/url.dto.ts'

const day = z.iso.date('Usa una fecha con el formato AAAA-MM-DD.')

/** Campos que se pueden escribir. */
export const bulletinFields = {
  date: day,
  /** El PDF: subido (/api/files/…) o una página /sitio/…. null = sin PDF. */
  pdfUrl: urlDto.nullable().optional(),
  flipbookUrl: urlDto.nullable().optional(),
  note: z.string().trim().max(200).optional(),
  published: z.boolean().optional(),
}

export const createBulletinDto = z.object(bulletinFields).strict()

export type CreateBulletinDto = z.infer<typeof createBulletinDto>
