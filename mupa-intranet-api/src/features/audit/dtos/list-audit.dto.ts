import { z } from 'zod'

/** Filtros: tipo de evento, "request:123" (sobre qué fue) y cuántos (los más nuevos primero). */
export const listAuditDto = z.object({
  type: z.string().trim().max(60).optional(),
  subject: z
    .string()
    .trim()
    .regex(/^[a-z]+:\d+$/, 'Usa el formato tipo:id, por ejemplo request:123.')
    .optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
})

export type ListAuditDto = z.infer<typeof listAuditDto>
