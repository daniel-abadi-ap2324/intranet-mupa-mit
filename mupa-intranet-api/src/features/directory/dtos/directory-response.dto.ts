import { z } from 'zod'

/** Ley 81: de cada persona u oficina solo lo que ya publicaba el Directorio. */
const personaDto = z.object({ nombre: z.string(), apellido: z.string(), direccion: z.string(), ext: z.string(), ubicacion: z.string(), unidad: z.string().optional(), soloBusqueda: z.boolean().optional() })

export const directoryResponseDto = z.object({
  personas: z.array(personaDto),
  /** Última sincronización buena con la central; null = datos fijos. */
  actualizadoEn: z.date().nullable(),
  fuente: z.enum(['central', 'fija']),
})

/** Central contra Directorio, solo para administración: con esto se decide a quién agregar, quitar o renombrar. */
export const directoryComparisonDto = z.object({
  estado: z.object({
    configurada: z.boolean(),
    sincronizacionAutomatica: z.boolean(),
    cadaMinutos: z.number(),
    ultimaBuena: z.date().nullable(),
    ultimoIntento: z.date().nullable(),
    error: z.string().nullable(),
    extensionesEnCentral: z.number(),
    fuente: z.enum(['central', 'fija']),
  }),
  soloEnCentral: z.array(z.object({ ext: z.string(), nombre: z.string() })),
  soloEnDirectorio: z.array(z.object({ ext: z.string(), nombre: z.string(), direccion: z.string() })),
  nombreDistinto: z.array(z.object({ ext: z.string(), directorio: z.string(), central: z.string(), direccion: z.string() })),
})
