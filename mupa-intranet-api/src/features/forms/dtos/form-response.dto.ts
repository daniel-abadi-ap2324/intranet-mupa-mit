import { z } from 'zod'

/** Lo que ve cualquiera: el formulario listo para llenar. */
export const formResponseDto = z.object({
  slug: z.string(),
  number: z.number(),
  title: z.string(),
  area: z.string(),
  destination: z.string(),
  deadline: z.string().nullable(),
  intro: z.string(),
  notes: z.array(z.string()),
  changes: z.array(z.string()),
  sections: z.array(z.unknown()),
  /** false = el envío es de prueba (no se guarda nada). */
  accepting: z.boolean(),
  /** true = su alcance está «a definir con RRHH»: no puede recibir solicitudes todavía. */
  pendingDefinition: z.boolean(),
})

/** Lo que ve el Gestor de Solicitudes en su panel. */
export const managedFormResponseDto = formResponseDto.extend({
  id: z.number(),
  published: z.boolean(),
  updatedAt: z.date(),
  updatedByName: z.string().nullable(),
  /** Solicitudes recibidas (con alguna, no se puede borrar). */
  requests: z.number(),
})

export type FormResponse = z.infer<typeof formResponseDto>
