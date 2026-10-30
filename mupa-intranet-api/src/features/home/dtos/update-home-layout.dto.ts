import { z } from 'zod'

import { homeLayoutDto } from './home-layout.dto.ts'

/** { layout: null } = volver al diseño de todos. */
export const updateHomeLayoutDto = z.object({ layout: homeLayoutDto.nullable() }).strict()

export type UpdateHomeLayoutDto = z.infer<typeof updateHomeLayoutDto>
