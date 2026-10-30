import { z } from 'zod'

const requestDto = z.object({
  number: z.number(),
  statusId: z.number(),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  location: z.string().nullable(),
  lineType: z.string().nullable(),
  extension: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  history: z.array(z.object({ action: z.string(), date: z.string() })),
})

/** Sin parámetros: ni la cédula ni nada más puede venir del navegador. */
export const callCodeRequestsQueryDto = z.object({}).strict()

/**
 * `available`: este servidor tiene conectado el sistema de códigos de llamada. `knownCedula`: se sabe la cédula de la
 * sesión (las cuentas de prueba no la tienen).
 */
export const callCodeRequestsResponseDto = z.object({
  available: z.boolean(),
  knownCedula: z.boolean(),
  total: z.number(),
  requests: z.array(requestDto),
})
export type CallCodeRequestsResponse = z.infer<typeof callCodeRequestsResponseDto>
