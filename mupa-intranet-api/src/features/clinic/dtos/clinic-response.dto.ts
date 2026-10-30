import { z } from 'zod'

const itemDto = z.object({ id: z.number(), name: z.string(), description: z.string().nullable() })

export const clinicResponseDto = z.object({
  services: z.array(itemDto),
  specialties: z.array(itemDto),
  closedWeekdays: z.array(z.number()),
  bookingWindow: z.object({ minDays: z.number(), maxDays: z.number() }),
  /** 'clinic': leído del sistema de citas; 'fallback': copia de respaldo (no respondió). */
  source: z.enum(['clinic', 'fallback']),
  updatedAt: z.date(),
})

export type ClinicResponse = z.infer<typeof clinicResponseDto>
