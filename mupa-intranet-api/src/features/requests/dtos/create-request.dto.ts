import { z } from 'zod'

const ruta = z.string().regex(/^s\d{1,2}(_[a-z0-9-]+)+$/, 'Campo desconocido.').max(200)
const pocos = <T extends z.ZodType>(schema: T, max: number) =>
  z.record(ruta, schema).refine((o) => Object.keys(o).length <= max, { message: 'Demasiadas respuestas.' })

/**
 * Enviar una solicitud: el slug del formulario y las respuestas tal como las arma
 * la web (textos por ruta, casillas marcadas e ítems de cada lista). Lo demás lo
 * revisa el servicio con la definición del formulario.
 */
export const createRequestDto = z
  .object({
    form: z.string().regex(/^[a-z0-9-]{1,80}$/),
    respuestas: z
      .object({
        v: pocos(z.string().max(5000), 500),
        c: pocos(z.array(z.number().int().min(0).max(99)).max(30), 100),
        i: pocos(z.array(z.number().int().positive().max(100000)).max(20), 50),
      })
      .strict(),
  })
  .strict()

export type CreateRequestDto = z.infer<typeof createRequestDto>
