import { z } from 'zod'

/** Lo que ve cualquiera: solo lo publicado, sin datos de quién lo editó. */
export const bulletinResponseDto = z.object({
  id: z.number(),
  date: z.string(),
  pdfUrl: z.string().nullable(),
  flipbookUrl: z.string().nullable(),
  /** Portada (página 1 del PDF); solo la tienen los que importa la sincronización con mupa.gob.pa. */
  coverUrl: z.string().nullable(),
  note: z.string(),
  /** Descripción corta (los titulares); null si no se pudo sacar del PDF. */
  summary: z.string().nullable(),
  /** Palabras clave, de la más a la menos importante. */
  keywords: z.array(z.string()),
})

/** Lo que ve Comunicación en su panel: además, si está publicado y la última edición. */
export const managedBulletinResponseDto = bulletinResponseDto.extend({
  published: z.boolean(),
  updatedAt: z.date(),
  /** Nombre de quien lo editó por última vez; null si esa cuenta ya no existe. */
  updatedByName: z.string().nullable(),
})
