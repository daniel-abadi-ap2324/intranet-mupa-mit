import { z } from 'zod'

/** Si el asistente puede responder (hay servidor de inferencia configurado). */
export const assistantStatusResponseDto = z.object({ available: z.boolean() })

export type AssistantStatusResponse = z.infer<typeof assistantStatusResponseDto>
