import { z } from 'zod'

import { formSectionsDto } from './form-definition.dto.ts'

const lines = z.array(z.string().trim().min(1).max(300)).max(10)

/** Campos que se pueden escribir. El slug se genera del título y no cambia (es la dirección del formulario). */
export const formFields = {
  title: z.string().trim().min(1).max(160),
  /** Sin número, se usa el siguiente libre. */
  number: z.number().int().positive().max(9999).optional(),
  area: z.string().trim().min(1).max(60),
  destination: z.string().trim().max(160).optional(),
  deadline: z
    .string()
    .trim()
    .max(60)
    .transform((s) => s || null)
    .nullable()
    .optional(),
  intro: z.string().trim().max(500).optional(),
  notes: lines.optional(),
  changes: lines.optional(),
  sections: formSectionsDto,
  accepting: z.boolean().optional(),
  /** «A definir con RRHH»: mientras esté marcado, no puede recibir solicitudes. */
  pendingDefinition: z.boolean().optional(),
  published: z.boolean().optional(),
}

export const createFormDto = z.object(formFields).strict()

export type CreateFormDto = z.infer<typeof createFormDto>
