import { z } from 'zod'

import { env, type ClinicApiConfig } from '../../config/env.ts'
import { DomainError } from '../errors/domain-error.ts'

const UNAVAILABLE = 'El sistema de la Clínica no responde. Intenta de nuevo en unos minutos.'
const UPSTREAM_ERROR = 'El sistema de la Clínica tuvo un problema. Intenta de nuevo en unos minutos.'

/** Una cita del historial de la Clínica (lo que la intranet toma de cada fila). */
export type ClinicAppointment = {
  id: string
  /** YYYY-MM-DD */
  date: string
  time: string | null
  type: string | null
  specialty: string | null
  doctor: string | null
  /** AGENDADA, VENCIDA, NO_ASISTIO, CANCELADA, EN_ESPERA, ATENDIDA o ASISTIO (los de la guía de la Clínica). */
  status: string
  attended: boolean
  cancelled: boolean
}

export type ClinicHistory = { patientFound: boolean; total: number; appointments: ClinicAppointment[] }

const text = z.string().nullish().transform((s) => s?.trim() || null)

// Respuesta de GET /recepcion/integracion/historial/:cedula ({ success, paciente, desde, hasta, resumen, data: [...] }).
const historySchema = z.object({
  paciente: z.unknown().nullish(),
  resumen: z.object({ total: z.number() }).partial().nullish(),
  data: z.array(
    z.object({
      id: z.union([z.number(), z.string()]).transform(String),
      fecha: z.string().transform((f) => f.slice(0, 10)),
      hora: text,
      tipo: text,
      especialidad: text,
      medico: text,
      estado: z.string().transform((e) => e.trim().toUpperCase()),
      asistio: z.boolean().nullish(),
      atendido: z.boolean().nullish(),
      cancelado: z.boolean().nullish(),
    }),
  ),
})

/**
 * Cliente de la API de la Clínica para otros sistemas: el historial de citas de un paciente por cédula
 * (GET /recepcion/integracion/historial/:cedula, con la llave en X-Api-Key). Solo lectura. La cédula
 * siempre es la de la sesión de quien pregunta (nunca la que mande el navegador). Nunca se registran la llave,
 * la cédula ni el contenido de la respuesta.
 */
export class ClinicAppointmentsService {
  private readonly config: ClinicApiConfig

  constructor(config: ClinicApiConfig) {
    this.config = config
  }

  async history(cedula: string, range: { from?: string; to?: string } = {}): Promise<ClinicHistory> {
    const query = new URLSearchParams()
    if (range.from) query.set('desde', range.from)
    if (range.to) query.set('hasta', range.to)
    const path = `/recepcion/integracion/historial/${encodeURIComponent(cedula)}${query.size ? `?${query}` : ''}`

    let res: Response
    try {
      res = await fetch(this.config.url + path, {
        headers: { Accept: 'application/json', 'X-Api-Key': this.config.apiKey },
        redirect: 'manual',
        signal: AbortSignal.timeout(this.config.timeoutMs),
      })
    } catch (err) {
      console.error(`La Clínica no respondió al historial de citas (${(err as Error).name})`)
      throw new DomainError(UNAVAILABLE, 503, 'CLINIC_UNAVAILABLE')
    }
    if (res.status === 429) throw new DomainError('Se hicieron demasiadas consultas a la Clínica. Espera unos minutos.', 503, 'CLINIC_BUSY')
    if (res.status === 400) throw new DomainError('La Clínica no pudo leer tu cédula. Avisa a la Mesa de Servicios (ext. 1400).', 502, 'CLINIC_REJECTED')
    if (res.status === 401) {
      console.error('La Clínica rechazó la llave de integración (CLINIC_API_KEY).')
      throw new DomainError(UPSTREAM_ERROR, 502, 'CLINIC_ERROR')
    }
    const parsed = historySchema.safeParse(await res.json().catch(() => null))
    if (!res.ok || !parsed.success) {
      console.error(`La Clínica respondió ${res.status}${res.ok ? ' con un formato inesperado' : ''} en el historial de citas.`)
      throw new DomainError(UPSTREAM_ERROR, 502, 'CLINIC_ERROR')
    }
    const { paciente, resumen, data } = parsed.data
    return {
      patientFound: paciente != null,
      total: resumen?.total ?? data.length,
      appointments: data.map((c) => ({
        id: c.id,
        date: c.fecha,
        time: c.hora,
        type: c.tipo,
        specialty: c.especialidad,
        doctor: c.medico,
        status: c.estado,
        attended: c.atendido === true,
        cancelled: c.cancelado === true || c.estado === 'CANCELADA',
      })),
    }
  }
}

export const clinicAppointmentsService = env.clinicApi ? new ClinicAppointmentsService(env.clinicApi) : null
