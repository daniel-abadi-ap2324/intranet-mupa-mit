import { z } from 'zod'

/** GET /bulletins?q=palabras: busca en la descripción, las palabras clave, el texto y la fecha. */
export const bulletinQueryDto = z.object({ q: z.string().trim().max(100, 'Escribe menos de 100 caracteres.').optional() })

export type BulletinQueryDto = z.infer<typeof bulletinQueryDto>
