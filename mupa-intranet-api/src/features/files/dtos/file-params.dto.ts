import { z } from 'zod'

/** /api/files/:id/:name — el nombre es solo para que la dirección sea legible; manda el id. */
export const fileParamsDto = z.object({ id: z.coerce.number().int().positive(), name: z.string().max(120).optional() })

export type FileParamsDto = z.infer<typeof fileParamsDto>
