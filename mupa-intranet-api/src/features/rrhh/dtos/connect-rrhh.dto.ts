import { z } from 'zod'

import { CEDULA } from '../../../shared/cedula.ts'

/**
 * Número de cargo. La cédula solo se pide si la sesión no la conoce (o no hay sesión).
 * Solo pasan hacia RH Link: no se guardan ni se registran.
 */
export const connectRrhhDto = z
  .object({
    cedula: z.string().trim().toUpperCase().regex(CEDULA, 'Escribe la cédula con guiones, por ejemplo 8-123-456.').optional(),
    password: z.string().min(1, 'Escribe tu número de cargo.').max(200),
  })
  .strict()

export type ConnectRrhhDto = z.infer<typeof connectRrhhDto>
