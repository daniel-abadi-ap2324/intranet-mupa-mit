import { z } from 'zod'

/**
 * `username` es el usuario de Identity Central (según cómo se dio de alta, un correo
 * u otro identificador) o, con LOCAL_LOGIN_ENABLED, el correo de una cuenta local.
 * No se guarda en ningún lado.
 */
export const loginDto = z
  .object({
    username: z.string().trim().min(1).max(254),
    password: z.string().min(1).max(200),
  })
  .strict()

export type LoginDto = z.infer<typeof loginDto>
