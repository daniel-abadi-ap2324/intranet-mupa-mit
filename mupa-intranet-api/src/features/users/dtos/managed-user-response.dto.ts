import { z } from 'zod'

import { userResponseDto } from './user-response.dto.ts'

/** Una persona en el panel de administración. */
export const managedUserResponseDto = userResponseDto.extend({
  departmentName: z.string().nullable(),
  /** identity = entra con el login de la Alcaldía; local = cuenta ficticia de prueba. */
  source: z.enum(['identity', 'local']),
  /** Cuándo se suspendió; null = activa. */
  suspendedAt: z.date().nullable(),
  lastLoginAt: z.date().nullable(),
  createdAt: z.date(),
})

export type ManagedUserResponse = z.infer<typeof managedUserResponseDto>
