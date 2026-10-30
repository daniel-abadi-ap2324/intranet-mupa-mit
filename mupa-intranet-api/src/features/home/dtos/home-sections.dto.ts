import { z } from 'zod'

import { urlDto } from '../../../shared/dtos/url.dto.ts'

/**
 * Secciones del contenido del Inicio que Comunicación edita desde su panel. Cada
 * una tiene su forma; el resto del contenido (directorio, clínica, mesa…) sigue
 * viniendo de los datos iniciales.
 */
const text = (max: number) => z.string().trim().max(max)
const title = z.string().trim().min(1).max(80)
const glyph = text(4).optional()
const color = text(20).optional()
const link = urlDto.nullable().optional()

/** Una fila con icono, como las de Trámites frecuentes. */
const row = z.object({ t: title, meta: text(160).optional(), g: glyph, color, h: link }).strict()

export const HOME_SECTION_DTOS = {
  intro: text(300),
  frecuentes: z
    .object({
      nota: text(300).optional(),
      items: z.array(row.extend({ sla: text(40).optional() }).strict()).max(12),
    })
    .strict(),
  campanas: z
    .object({
      nota: text(300).optional(),
      items: z
        .array(
          z
            .object({
              src: urlDto.refine((u) => u !== null, { message: 'Sube o escribe la imagen.' }),
              alt: z.string().trim().min(1).max(160),
              h: link,
            })
            .strict(),
        )
        .max(12),
    })
    .strict(),
  enlaces: z.array(z.object({ t: title, g: glyph, h: link }).strict()).max(20),
} as const

export type HomeSection = keyof typeof HOME_SECTION_DTOS
export const HOME_SECTIONS = Object.keys(HOME_SECTION_DTOS) as HomeSection[]
