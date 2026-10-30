import { z } from 'zod'

import { homeLayoutDto } from './home-layout.dto.ts'

/** El diseño propio (null sin sesión o si no personalizó) y el de todos (null = el de la propuesta). */
export const homeLayoutsResponseDto = z.object({
  personal: homeLayoutDto.nullable(),
  default: homeLayoutDto.nullable(),
})

export const homeLayoutResponseDto = z.object({ layout: homeLayoutDto.nullable() })

/** Contenido editable del Inicio: un objeto por sección (noticias, enlaces…). */
export const homeContentResponseDto = z.record(z.string(), z.unknown())
