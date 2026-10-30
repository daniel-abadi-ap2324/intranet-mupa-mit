import { z } from 'zod'

import { env } from '../../../config/env.ts'
import { CEDULA } from '../../../shared/cedula.ts'

// Un campo opcional que llega vacío ("") cuenta como no escrito.
const blankToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)
const optionalText = (max: number) => z.preprocess(blankToUndefined, z.string().trim().max(max).optional())

/** Solo correos institucionales (CORREO_DOMINIOS): con uno personal no se crea la cuenta en Identity Central. */
const dominios = env.CORREO_DOMINIOS.map((d) => d.toLowerCase().replace(/^@/, ''))
export const esCorreoInstitucional = (email: string) => dominios.includes(email.toLowerCase().split('@').pop() ?? '')
// Un correo mal escrito ya tiene su error: este solo sale si el formato está bien.
const institucional = `Usa tu correo institucional (${dominios.map((d) => '@' + d).join(' o ')}).`

/**
 * Registro sin aprobación: cualquiera con cédula y contraseña queda con cuenta de
 * uso normal. La cédula va al central y no se guarda en la intranet. El correo es
 * opcional aquí (hoy el central todavía lo exige y su error vuelve en el campo `email`),
 * pero si viene tiene que ser institucional.
 */
export const registerDto = z
  .object({
    identityNumber: z.string().trim().toUpperCase().regex(CEDULA, 'Escribe la cédula con guiones, por ejemplo 8-123-456.'),
    // Opcionales: con la verificación de RH Link el nombre sale de ahí. Sin ella (o si RH Link no lo trae) se piden.
    firstName: optionalText(100),
    lastName: optionalText(100),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.').max(200),
    email: z.preprocess(blankToUndefined, z.email('Escribe un correo válido.').max(254).refine((v) => !z.email().safeParse(v).success || esCorreoInstitucional(v), institucional).optional()),
    phone: optionalText(30),
    mobile: optionalText(30),
    jobTitle: optionalText(120),
    /** Opcional: el departamento sale de RH Link al entrar; si no se puede, la intranet se lo pide a la persona. */
    departmentId: z.number().int().positive().nullable().optional(),
  })
  .strict()

export type RegisterDto = z.infer<typeof registerDto>
