import { z } from 'zod'

/** El código que le llegó a la persona por correo. El correo sale de la sesión, no del body. */
export const verifyEmailDto = z.object({ code: z.string().trim().min(4).max(12) }).strict()

export type VerifyEmailDto = z.infer<typeof verifyEmailDto>
