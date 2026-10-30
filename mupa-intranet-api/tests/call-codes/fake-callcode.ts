/**
 * API de códigos de llamada falsa para las pruebas: solo la consulta de solicitudes por cédula
 * (GET /api/external/pin-requests?identityNumber= con la llave en X-Api-Key), con el contrato de su documentación
 * (todas las respuestas llevan { statusCode, data, message, isSuccess, errors, timestamp }). Personas y solicitudes ficticias.
 */
import type { Server } from 'node:http'

import express from 'express'

export type FakeSolicitud = {
  requestNumber: number
  statusId: number
  status: string
  createdDate: string
  lastModifiedDate: string
  location: string
  lineType: string
  extension: string
  rejectionReason: string | null
  history: { action: string; date: string }[]
}
type Forced = { status: number; body?: string } | 'drop'

const sobre = (statusCode: number, data: unknown, message: string, errors: string[] = []) => ({ statusCode, data, message, isSuccess: statusCode === 200, errors, timestamp: new Date().toISOString() })

export async function startFakeCallCodes(options: { url: string; apiKey: string }) {
  const personas = new Map<string, FakeSolicitud[]>()
  const requests: { path: string; query: Record<string, unknown>; key?: string }[] = []
  const state: { next: Forced | null } = { next: null }

  const app = express()
  app.get('/api/external/pin-requests', (req, res) => {
    requests.push({ path: req.originalUrl.split('?')[0], query: { ...req.query }, key: req.header('x-api-key') })
    const o = state.next
    if (o) {
      state.next = null
      if (o === 'drop') return req.socket.destroy()
      return res.status(o.status).type('application/json').send(o.body ?? '')
    }
    if (req.header('x-api-key') !== options.apiKey) return res.status(401).json(sobre(401, null, 'No autorizado.', ['API key inválida o ausente.']))
    const cedula = req.query.identityNumber
    if (typeof cedula !== 'string' || !cedula) return res.status(400).json(sobre(400, null, 'Solicitud inválida.', ['El parámetro identityNumber es obligatorio.']))
    const lista = personas.get(cedula) ?? []
    res.json(sobre(200, lista, lista.length ? 'Acción completada exitosamente.' : 'No se encontraron solicitudes para la cédula indicada.'))
  })

  const url = new URL(options.url)
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(Number(url.port), url.hostname, () => resolve(s))
  })

  return {
    requests,
    addPersona(cedula: string, solicitudes: FakeSolicitud[]) {
      personas.set(cedula, solicitudes)
    },
    failNext(o: Forced) {
      state.next = o
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}

export type FakeCallCodes = Awaited<ReturnType<typeof startFakeCallCodes>>
