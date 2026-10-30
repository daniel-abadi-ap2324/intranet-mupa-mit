import { z } from 'zod'

import { env, type CallCodeApiConfig } from '../../config/env.ts'
import { DomainError } from '../errors/domain-error.ts'

const UNAVAILABLE = 'El sistema de códigos de llamada no responde. Intenta de nuevo en unos minutos.'
const UPSTREAM_ERROR = 'El sistema de códigos de llamada tuvo un problema. Intenta de nuevo en unos minutos.'

/** Un paso del historial de una solicitud. `action`: CREATE, APPROVE, REJECT, PROCESS, UPDATE, STATUS_CHANGE o ANULAR. */
export type CallCodeHistoryEntry = { action: string; date: string }

/** Una solicitud de código de llamada (lo que la intranet toma de cada fila). Fechas en hora de Panamá, sin zona. */
export type CallCodeRequest = {
  number: number
  /** 1 a 3 pendientes, 4 aprobado, 5 rechazado, 6 procesado (código generado), 7 anulado. La lógica va por este número. */
  statusId: number
  status: string
  createdAt: string
  updatedAt: string
  location: string | null
  lineType: string | null
  extension: string | null
  rejectionReason: string | null
  history: CallCodeHistoryEntry[]
}

const text = z.string().nullish().transform((s) => s?.trim() || null)

// Respuesta de GET /api/external/pin-requests ({ statusCode, data, message, isSuccess, errors, timestamp }). El PIN nunca viene.
const responseSchema = z.object({
  data: z
    .array(
      z.object({
        requestNumber: z.number(),
        statusId: z.number(),
        status: z.string(),
        createdDate: z.string(),
        lastModifiedDate: z.string().nullish().transform((s) => s ?? ''),
        location: text,
        lineType: text,
        extension: text,
        rejectionReason: text,
        history: z.array(z.object({ action: z.string(), date: z.string() })).nullish().transform((h) => h ?? []),
      }),
    )
    .nullable(),
})

/**
 * Cliente de la API de códigos de llamada: las solicitudes de PIN de una persona por cédula
 * (GET /api/external/pin-requests?identityNumber=, con la llave en X-Api-Key). Solo lectura. La cédula siempre es la de
 * la sesión de quien pregunta (nunca la que mande el navegador). Nunca se registran la llave, la cédula ni la respuesta.
 */
export class CallCodeService {
  private readonly config: CallCodeApiConfig

  constructor(config: CallCodeApiConfig) {
    this.config = config
  }

  async requests(cedula: string): Promise<CallCodeRequest[]> {
    let res: Response
    try {
      res = await fetch(`${this.config.url}/api/external/pin-requests?${new URLSearchParams({ identityNumber: cedula })}`, {
        headers: { Accept: 'application/json', 'X-Api-Key': this.config.apiKey },
        redirect: 'manual',
        signal: AbortSignal.timeout(this.config.timeoutMs),
      })
    } catch (err) {
      console.error(`El sistema de códigos de llamada no respondió (${(err as Error).name})`)
      throw new DomainError(UNAVAILABLE, 503, 'CALLCODE_UNAVAILABLE')
    }
    if (res.status === 400) throw new DomainError('El sistema de códigos de llamada no pudo leer tu cédula. Avisa a la Mesa de Servicios (ext. 1400).', 502, 'CALLCODE_REJECTED')
    if (res.status === 401) {
      console.error('El sistema de códigos de llamada rechazó la llave de integración (CALLCODE_API_KEY).')
      throw new DomainError(UPSTREAM_ERROR, 502, 'CALLCODE_ERROR')
    }
    const parsed = responseSchema.safeParse(await res.json().catch(() => null))
    if (!res.ok || !parsed.success) {
      console.error(`El sistema de códigos de llamada respondió ${res.status}${res.ok ? ' con un formato inesperado' : ''}.`)
      throw new DomainError(UPSTREAM_ERROR, 502, 'CALLCODE_ERROR')
    }
    return (parsed.data.data ?? []).map((r) => ({
      number: r.requestNumber,
      statusId: r.statusId,
      status: r.status,
      createdAt: r.createdDate,
      updatedAt: r.lastModifiedDate || r.createdDate,
      location: r.location,
      lineType: r.lineType,
      extension: r.extension,
      // Solo viene con valor en las rechazadas (statusId 5).
      rejectionReason: r.statusId === 5 ? r.rejectionReason : null,
      history: r.history,
    }))
  }
}

export const callCodeService = env.callCodeApi ? new CallCodeService(env.callCodeApi) : null
