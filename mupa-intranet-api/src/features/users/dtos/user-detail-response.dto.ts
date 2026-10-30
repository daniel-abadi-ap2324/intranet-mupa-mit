import { z } from 'zod'

import { managedUserResponseDto } from './managed-user-response.dto.ts'

/**
 * La ficha de una persona para administración (GET /api/users/:id, solo admin): todo menos la contraseña.
 * Lleva la cédula, que no sale en ninguna otra respuesta.
 */
export const userDetailResponseDto = managedUserResponseDto.extend({
  /** Con guiones; null = todavía no ha entrado desde que se guarda (o es cuenta de prueba). */
  cedula: z.string().nullable(),
  /** El `sub` de Identity Central (para buscarla allá); null = cuenta de prueba. */
  identitySub: z.string().nullable(),
  /** Autodeclarados al registrarse. */
  phone: z.string().nullable(),
  jobTitle: z.string().nullable(),
  failedLoginAttempts: z.number(),
  /** Bloqueada por intentos fallidos hasta esta hora (solo cuentas de prueba). */
  lockedUntil: z.date().nullable(),
  updatedAt: z.date(),
  activeSessions: z.number(),
  requests: z.number(),
  openRequests: z.number(),
  rrhh: z.discriminatedUnion('status', [
    z.object({ status: z.enum(['unconfigured', 'no-cedula', 'not-found', 'error']) }),
    z.object({
      status: z.literal('found'),
      active: z.boolean(),
      fullName: z.string().nullable(),
      locationCode: z.number().nullable(),
      /** El departamento de la intranet con ese código de ubicación; null = ninguno. */
      locationDepartment: z.string().nullable(),
    }),
  ]),
})

export type UserDetailResponse = z.infer<typeof userDetailResponseDto>
