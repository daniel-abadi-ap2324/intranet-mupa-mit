import { z } from 'zod'

import { tagResponseDto } from '../../tags/dtos/tag-response.dto.ts'

export const applicationResponseDto = z.object({
  id: z.number(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  /** null = sin enlace (o de "solo red interna" para quien no edita el catálogo). */
  url: z.string().nullable(),
  area: z.string(),
  icon: z.string(),
  tags: z.array(tagResponseDto),
  access: z.string(),
  status: z.string(),
  external: z.boolean(),
  pdf: z.boolean(),
  featured: z.boolean(),
  confirmed: z.boolean(),
  keywords: z.string(),
  origin: z.string(),
  published: z.boolean(),
  /** Nota interna: solo para quien edita el catálogo. */
  note: z.string().optional(),
  /** Departamentos que la ven (vacío = todos): solo para quien edita el catálogo. */
  departments: z.array(z.object({ id: z.number(), name: z.string() })).optional(),
})

export type ApplicationResponse = z.infer<typeof applicationResponseDto>
