import { z } from 'zod'

/** Respuesta del asistente: texto corto, los slugs de las aplicaciones del catálogo que sirven y las páginas de la intranet (solo existentes). */
export const assistantResponseDto = z.object({
  answer: z.string(),
  applications: z.array(z.string()),
  pages: z.array(z.object({ path: z.string(), title: z.string() })),
  /** Contenido concreto (un boletín, una noticia, un formulario) con su ruta en la intranet. */
  items: z.array(z.object({ kind: z.enum(['boletin', 'noticia', 'formulario']), title: z.string(), path: z.string(), meta: z.string().nullable() })),
})

export type AssistantResponse = z.infer<typeof assistantResponseDto>
