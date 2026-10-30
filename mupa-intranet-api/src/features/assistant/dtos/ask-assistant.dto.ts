import { z } from 'zod'

export const askAssistantDto = z
  .object({
    question: z.string().trim().min(2).max(300),
  })
  .strict()

export type AskAssistantDto = z.infer<typeof askAssistantDto>
