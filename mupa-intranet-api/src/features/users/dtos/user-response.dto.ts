import { z } from 'zod'

/**
 * Lo único que sale de una cuenta hacia el cliente: nunca el hash de la clave, el
 * estado de bloqueo, el `sub` de Identity Central ni sus tokens. `email` puede ser
 * null (cuentas de Identity Central sin correo).
 */
export const userResponseDto = z.object({
  id: z.number(),
  email: z.string().nullable(),
  /** null = no se sabe (cuentas de prueba). */
  emailVerified: z.boolean().nullable(),
  firstName: z.string(),
  lastName: z.string().nullable(),
  roles: z.array(z.string()),
  /** Lo asigna administración; null = sin departamento. */
  departmentId: z.number().nullable(),
  /** Cuándo vio el recorrido para usuarios nuevos; null = todavía no (el Inicio se lo muestra). */
  tourSeenAt: z.date().nullable(),
})

export type UserResponse = z.infer<typeof userResponseDto>
