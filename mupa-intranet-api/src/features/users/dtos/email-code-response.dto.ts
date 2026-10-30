import { z } from 'zod'

/** A dónde se mandó el código (enmascarado por el central, p. ej. "da***@gmail.com") y cuánto dura. */
export const emailCodeResponseDto = z.object({
  maskedEmail: z.string().nullable(),
  expiresInMinutes: z.number().nullable(),
})
