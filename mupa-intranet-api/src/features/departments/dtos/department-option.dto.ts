import { z } from 'zod'

/** Un departamento para elegir en una lista: sin cuántas personas o aplicaciones tiene. */
export const departmentOptionDto = z.object({ id: z.number(), name: z.string() })
