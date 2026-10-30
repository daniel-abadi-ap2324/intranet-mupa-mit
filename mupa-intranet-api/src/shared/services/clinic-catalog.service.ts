import { z } from 'zod'

import { env, type ClinicConfig } from '../../config/env.ts'

/**
 * Cliente del catálogo PÚBLICO del sistema de citas de la Clínica Municipal
 * (clinica.mupa.gob.pa, el que usa el formulario /formulario sin iniciar sesión):
 * servicios, especialidades y días de atención. Nada de pacientes ni de citas:
 * esas rutas (por cédula) no se llaman desde aquí.
 */

// Lo que interesa de cada respuesta ({ success, data, … }).
const servicesSchema = z.object({ data: z.array(z.object({ id: z.number(), nombre: z.string(), descripcion: z.string().nullish() })) })
const specialtiesSchema = z.object({ data: z.array(z.object({ id: z.number(), especialidad: z.string(), descripcion: z.string().nullish() })) })
const daysSchema = z.object({
  data: z.array(z.number().int().min(0).max(6)),
  ventana: z.object({ minimo: z.number().int().min(0), maximo: z.number().int().positive() }).optional(),
})

export type ClinicCatalog = {
  services: { id: number; name: string; description: string | null }[]
  specialties: { id: number; name: string; description: string | null }[]
  /** Días de la semana sin atención (0 = domingo … 6 = sábado). */
  closedWeekdays: number[]
  /** Con cuántos días de anticipación se puede reservar (mínimo y máximo). */
  bookingWindow: { minDays: number; maxDays: number }
}

/** Id del servicio "Atención médica" en el sistema de la Clínica: sus especialidades son las que se ofrecen. */
const MEDICAL_SERVICE_ID = 1

export class ClinicCatalogService {
  private readonly config: ClinicConfig

  constructor(config: ClinicConfig) {
    this.config = config
  }

  /** Lanza un Error si la Clínica no responde o responde algo inesperado. */
  async fetchCatalog(): Promise<ClinicCatalog> {
    const [services, specialties, days] = await Promise.all([
      this.get('/formulario/api/servicios-hoy', servicesSchema),
      this.get(`/formulario/api/especialidades?servicio=${MEDICAL_SERVICE_ID}`, specialtiesSchema),
      this.get('/formulario/api/dias-inactivos', daysSchema),
    ])
    return {
      services: services.data.map((s) => ({ id: s.id, name: s.nombre.trim(), description: s.descripcion?.trim() || null })),
      specialties: specialties.data.map((s) => ({ id: s.id, name: s.especialidad.trim(), description: s.descripcion?.trim() || null })),
      closedWeekdays: [...new Set(days.data)].sort(),
      bookingWindow: { minDays: days.ventana?.minimo ?? 1, maxDays: days.ventana?.maximo ?? 90 },
    }
  }

  private async get<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    const res = await fetch(this.config.url + path, {
      headers: { Accept: 'application/json' },
      redirect: 'manual',
      signal: AbortSignal.timeout(this.config.timeoutMs),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} en ${path}`)
    const body = schema.safeParse(await res.json().catch(() => null))
    if (!body.success) throw new Error(`Respuesta inesperada en ${path}`)
    return body.data
  }
}

export const clinicCatalogService = new ClinicCatalogService(env.clinic)
