import { z } from 'zod'

const ticketDto = z.object({
  id: z.number(),
  title: z.string(),
  status: z.number(),
  openedAt: z.string(),
  updatedAt: z.string(),
})

/** Sin parámetros: ni la cédula ni nada más puede venir del navegador. */
export const glpiTicketsQueryDto = z.object({}).strict()

/**
 * `available`: este servidor tiene conectado GLPI. `knownCedula`: se sabe la cédula de la sesión (las cuentas de prueba
 * no la tienen). `userFound`: algún usuario de GLPI tiene esa cédula en «Teléfono»; si no, sus tickets no se pueden ver.
 */
export const glpiTicketsResponseDto = z.object({
  available: z.boolean(),
  knownCedula: z.boolean(),
  userFound: z.boolean(),
  total: z.number(),
  tickets: z.array(ticketDto),
})
export type GlpiTicketsResponse = z.infer<typeof glpiTicketsResponseDto>
