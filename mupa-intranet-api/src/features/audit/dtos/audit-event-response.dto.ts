import { z } from 'zod'

export const auditEventResponseDto = z.object({
  id: z.string(),
  type: z.string(),
  actorId: z.number().nullable(),
  subjectType: z.string().nullable(),
  subjectId: z.number().nullable(),
  payload: z.unknown(),
  deliveredCount: z.number(),
  createdAt: z.date(),
})

export type AuditEventResponse = z.infer<typeof auditEventResponseDto>
