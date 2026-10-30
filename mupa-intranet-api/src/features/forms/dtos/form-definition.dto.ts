import { z } from 'zod'

/**
 * Definición de un formulario: secciones y campos, el mismo formato que pinta la
 * web (mupa-intranet-app/src/lib/formularios.ts). Un campo puede tener otros
 * dentro: las casillas (checks) sus sub-campos, y las listas que crecen (repeat)
 * los campos de cada elemento.
 */
export const FIELD_TYPES = ['text', 'email', 'tel', 'cedula', 'number', 'textarea', 'select', 'radio', 'checks', 'repeat'] as const
/** Datos del perfil con los que se completa un campo solo. */
export const PROFILE_KEYS = ['nombreCompleto', 'correo', 'cargo', 'direccion', 'extension'] as const

export type FormField = {
  k?: string
  l: string
  t: (typeof FIELD_TYPES)[number]
  r?: boolean
  auto?: (typeof PROFILE_KEYS)[number]
  hint?: string
  opts?: string[]
  items?: { l: string; sub?: FormField[] }[]
  min?: number
  max?: number
  item?: string
  add?: string
  fields?: FormField[]
}
export type FormSection = { title: string; desc?: string; show?: { k: string; v: string }; fields: FormField[] }

const label = z.string().trim().min(1).max(160)

export const formFieldDto: z.ZodType<FormField> = z.lazy(() =>
  z
    .object({
      k: z
        .string()
        .trim()
        .regex(/^[a-z0-9-]{1,40}$/, 'Usa solo minúsculas, números y guiones.')
        .optional(),
      l: label,
      t: z.enum(FIELD_TYPES),
      r: z.boolean().optional(),
      auto: z.enum(PROFILE_KEYS).optional(),
      hint: z.string().trim().max(300).optional(),
      opts: z.array(label).max(50).optional(),
      items: z.array(z.object({ l: label, sub: z.array(formFieldDto).max(20).optional() }).strict()).max(30).optional(),
      min: z.number().int().min(0).max(9999).optional(),
      max: z.number().int().min(0).max(9999).optional(),
      item: z.string().trim().max(40).optional(),
      add: z.string().trim().max(60).optional(),
      fields: z.array(formFieldDto).max(20).optional(),
    })
    .strict()
    .superRefine((c, ctx) => {
      const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })
      if ((c.t === 'select' || c.t === 'radio') && (c.opts?.length ?? 0) < 2) issue('opts', 'Pon al menos dos opciones.')
      if (c.t === 'checks' && !c.items?.length) issue('items', 'Pon al menos una casilla.')
      if (c.t === 'repeat' && !c.fields?.length) issue('fields', 'La lista necesita al menos un campo.')
      if (c.min !== undefined && c.max !== undefined && c.min > c.max) issue('max', 'El máximo no puede ser menor que el mínimo.')
    }),
)

export const formSectionDto = z
  .object({
    title: label,
    desc: z.string().trim().max(300).optional(),
    /** La sección solo se ve si la opción única con esa clave vale `v`. */
    show: z.object({ k: z.string().trim().min(1).max(40), v: label }).strict().optional(),
    fields: z.array(formFieldDto).min(1, 'La sección necesita al menos un campo.').max(40),
  })
  .strict()

export const formSectionsDto = z.array(formSectionDto).min(1, 'El formulario necesita al menos una sección.').max(12)
