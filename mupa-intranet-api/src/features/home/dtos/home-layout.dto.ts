import { z } from 'zod'

/**
 * Diseño del Inicio (lo arma el frontend, src/lib/bloques.ts). El backend
 * valida la ESTRUCTURA sin conocer el catálogo de bloques (ese vive en el
 * frontend, que además descarta los que ya no existen al leer):
 * máx. 30 bloques, tamaños conocidos, textos cortos y enlaces solo http/https.
 * `ocultos`: lo que la persona escondió de un bloque con lista larga ("Elegir qué
 * mostrar"), identificado por su destino. `buscador`: tamaño del bloque fijo del
 * saludo y la búsqueda (sin él, completo).
 */
const WIDTHS = ['tercio', 'media', 'dos-tercios', 'completa'] as const

const text = (max: number) =>
  z
    .string()
    .max(max)
    .regex(/^[^<>]*$/, 'No se permiten los caracteres < ni >')

const linkDto = z
  .object({
    t: text(60),
    h: z.url({ protocol: /^https?$/ }).max(500),
  })
  .strict()

const blockConfigDto = z
  .object({
    tipo: z.enum(['etiqueta', 'area']).optional(),
    valor: text(60).optional(),
    cantidad: z.union([z.literal(4), z.literal(6), z.literal(8), z.literal(12)]).optional(),
    titulo: text(60).optional(),
    links: z.array(linkDto).max(8).optional(),
    ocultos: z.array(text(500).min(1)).max(40).optional(),
  })
  .strict()

const blockDto = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{2,40}$/),
    uid: z.string().regex(/^[a-z0-9-]{2,48}$/),
    ancho: z.enum(WIDTHS),
    cfg: blockConfigDto.optional(),
  })
  .strict()

export const homeLayoutDto = z
  .object({
    v: z.literal(1),
    items: z.array(blockDto).max(30),
    buscador: z.enum(WIDTHS).optional(),
  })
  .strict()
  .superRefine((layout, ctx) => {
    const seen = new Set<string>()
    layout.items.forEach((item, i) => {
      if (seen.has(item.uid)) ctx.addIssue({ code: 'custom', path: ['items', i, 'uid'], message: 'Bloque repetido' })
      seen.add(item.uid)
    })
  })

export type HomeLayout = z.infer<typeof homeLayoutDto>
