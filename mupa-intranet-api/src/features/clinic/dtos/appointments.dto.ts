import { z } from 'zod'

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato AAAA-MM-DD.')

/** Rango opcional del historial (la cédula nunca viene del navegador: sale de la sesión). */
export const appointmentsQueryDto = z.object({ from: date.optional(), to: date.optional() }).strict()
export type AppointmentsQueryDto = z.infer<typeof appointmentsQueryDto>

const appointmentDto = z.object({
  id: z.string(),
  date: z.string(),
  time: z.string().nullable(),
  type: z.string().nullable(),
  specialty: z.string().nullable(),
  doctor: z.string().nullable(),
  status: z.string(),
  attended: z.boolean(),
  cancelled: z.boolean(),
})

/**
 * `available`: este servidor tiene la API de la Clínica. `knownCedula`: se sabe la cédula de la sesión
 * (las cuentas de prueba no la tienen). `patientFound`: la Clínica tiene a esa persona como paciente.
 */
export const appointmentsResponseDto = z.object({
  available: z.boolean(),
  knownCedula: z.boolean(),
  patientFound: z.boolean(),
  total: z.number(),
  appointments: z.array(appointmentDto),
})
export type AppointmentsResponse = z.infer<typeof appointmentsResponseDto>
