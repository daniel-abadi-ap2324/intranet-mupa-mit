import { z } from 'zod'

export const formIdParamsDto = z.object({ id: z.coerce.number().int().positive() })
export const formSlugParamsDto = z.object({ slug: z.string().regex(/^[a-z0-9-]{1,80}$/) })

export type FormIdParamsDto = z.infer<typeof formIdParamsDto>
export type FormSlugParamsDto = z.infer<typeof formSlugParamsDto>
