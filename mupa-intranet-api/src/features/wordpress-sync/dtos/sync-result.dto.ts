import { z } from 'zod'

/** Resultado de una pasada: lo nuevo, lo que se saltó, y lo que falló (por elemento o de toda la sección). */
export const syncSectionDto = z.object({
  nuevos: z.number(),
  omitidos: z.number(),
  /** Cosas que no frenan la importación (p. ej. un boletín sin portada). */
  avisos: z.array(z.string()),
  errores: z.array(z.string()),
})

export const syncResultDto = z.object({
  startedAt: z.date(),
  finishedAt: z.date(),
  /** null cuando las noticias no están encendidas (edición «publicacion»). */
  noticias: syncSectionDto.nullable(),
  boletines: syncSectionDto,
})

export const syncStatusDto = z.object({
  enabled: z.boolean(),
  running: z.boolean(),
  intervalMinutes: z.number(),
  windowDays: z.number(),
  last: syncResultDto.nullable(),
})

export type SyncSection = z.infer<typeof syncSectionDto>
export type SyncResult = z.infer<typeof syncResultDto>
